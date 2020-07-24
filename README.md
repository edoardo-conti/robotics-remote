# 🎓 Progetto di Laurea #

## Introduzione ##

Progetto finalizzato alla realizzazione di un robot controllabile da remoto e programmabile in totale sicurezza tramite paradigma di programmazione a blocchi.

------------------------------------------

## Architettura Robot e Scelte Implementative ##

Di seguito la componentistica principale dell'hardware del robot:

- Il microcontrollore impiegato è un **Arduino UNO WiFi Rev2** che differisce dalla versione classica per il nuovo microchip *ATmega4809* (il classico Arduino UNO R3 è coadiuvato da microcontrollore *ATmega328*) e la dotazione di un modulo SoC con integrato uno stack TCP/IP completo il quale può offrire accesso ad una rete WiFi oppure agire come Access Point. 
- ~~La scelta della ventola d'aspirazione, dopo svariate valutazioni, è ricaduta sul seguente modello: AVC BA10033B12S da 12V 2.85A . L'assorbimento si attesta attorno ai ~34W ed è più che accettabile per assicurare un'autonomia al robot di circa 45min~~ *(al momento ventola NON più impiegata per nuovo concept del progetto).*
- ~~Il circuito per gestire la ventola è basato su MOSFET IRL7833PBF con rating 30V e 150A, più che sufficiente per reggere il carico elettrico richiesto~~ *(vedi punto sopra).*
- Gli spostamenti sono assicurati da due motori [Micro Metal Gearmotor HPCB 6V](https://www.pololu.com/product/3079) con ratio 298:1 .
- I servomotori sono gestiti da due driver [DRV8838](https://www.pololu.com/product/2990), uno per ogni motore per assicurare un'erogazione continua massima di 1.7A (peak = 1.8A) in 0-11V.
- Per la rilevazione di ostacoli, il robot vanta di un'array di 4 sensori di prossimità Sharp IR: 2 frontali con range di sensibilità 4-30cm ([GP2Y0A41SK0F](https://global.sharp/products/device/lineup/data/pdf/datasheet/gp2y0a41sk_e.pdf)) e 2 laterali con range di sensibilità 2-15cm ([GP2Y0A51SK0F](https://global.sharp/products/device/lineup/data/pdf/datasheet/gp2y0a51sk_e.pdf)). Nell'eventualità di un fallimento dei sensori nel rilevare ostacoli, nella parte frontale centrale del robot è presente un microswitch a levetta che funge da bumper.
- L'alimentazione è assicurata da una batteria LiPo "ZIPPY Compact" da 1300mAh da 12V (3S). La misurazione del livello di carica è realizzata con un semplice cirucito "voltage divider", la tensione in uscita è letta da pin analogico Arduino.
- La struttura è stata stampanta in 3D con materiale PETG per una buona resistenza agli urti rispetto ad eventualmente un classico PLA. Il modello misura 21x21x6.5cm e sono state necessarie circa 18 ore per completare la stampa ad una velocità di 50mm/s con una Anet A8. (Crediti: [Cesar Nieto](https://www.thingiverse.com/cesnietor/designs))

Si era optato l'impiego di un paio di [encoder magnetici](https://www.pololu.com/product/3081) per calcolare con precisione le rotazioni dei servomotori ma purtroppo non è stato possibile sfruttarli, causa malfunzionamento di un componente.

Dato il range di tensione per alimentare l'Arduino Uno WiFi Rev2 tramite pin dedicato `Vin` si sfrutta un regolatore DC-DC per convertire la tensione in entrata dalla batteria da 10.5-12.6V a 8V stabili. 

Di seguito una tabella riassuntiva delle linee d'alimentazione:
Batteria (10.5-12.6V) | Regolatore DC-DC (8V) | Arduino (3.3V) | Arduino (5V)
------------ | ------------- | ------------- | -------------
| Regolatore DC-DC | Arduino `Vin` | 2x Driver DRV8838 | 2x Sharp GP2Y0A41SK0F  |
| ~~Driver MOSFET Ventola~~ | 2x Servomotori  | - | 2x Sharp GP2Y0A51SK0F |
| - | - | - | Lettore Schede microSD |

Per dotare la scheda Arduino di storage permanente si è installato un lettore di schede microSD il quale ha richiesto, dato il diverso microcontrollore dalla SBC classica Arduino Uno, l'impiego dell'header ICSP. Grazie a questa aggiunta è possibile salvare in modo permanente e consistente i parametri di connettività alla rete WiFi.

Per limitare il rumore nelle letture dei sensori IR si è stabilizzato la linea d'alimentazione con un filtro di 2 condensatori tra linea e GND (100µF e 100nF) e 1 resistore nel pin del segnale in uscita. Purtroppo questi due prodotti sono risultati eccessivamente rumorosi ed inclini a generari segnali peak, il quale implicano un numero importante di falsi positivi. Per una futura rivisitazione (state of the art) del progetto sarebbe opportuno valutare moduli LIDAR (Time-Of-Flight).

------------------------------------------

## Software Robot ##

Il software è scritto in C/C++ data la natura del SBC. 
Di seguito le librerie fondamentali impiegate:
- **Battery.h** : Gestione dell'alimentazione da segnale analogico del voltage divider. Sfruttata per stimare e valutare il livello di carica della batteria per evitare di oltrepassare limiti di sicurezza convenzionali della tecnologia LiPo. Voltaggio valutato periodicamente con un periodo di 10s, se uguale o inferiore a 10.5V il robot viene arrestato e l'operatività interrotta. 
- **SharpDistSensor.h** : Elaborazione dei segnali in ingresso dei sensori Sharp IR. La libreria si dedica all'analisi dei segnali in ingresso restituendo un valore in unità millimetriche della distanza letta calcolata tramite filtro mediano di 3 campioni per migliorare la consistenza. 
- **WiFiNINA.h** : Comunicazione con modulo SoC WiFi integrato per la creazione di access point nelle fasi configurative iniziali e per collegarsi a reti (con protezione WPA2) tramite SSID e password. Fondamentale per l'instaurazione del web server incaricato di gestire le richieste HTTP provenienti dall'applicativo per interpretare ed eseguire le operazioni richieste.
- **SDConfigCommand.h** : Sistema per la lettura e scrittura di file di configurazione su scheda microSD tramite reader apposito. Sfruttato per salvare in modo permanente i parametri della rete WiFi a cui il robot deve connettersi ad ogni avvio.
- **Regexp.h** : Implementazione dell'uso di espressioni regolari in Arduino. Utilizzata per multiplexare richieste HTTP nel web server dato il basso livello implementativo di quest'ultimo nella libreria `WiFiNINA.h`.

### Modalità Operative ###
Nel caso di un primo avvio, il software:
1. Tenterà di collegarsi all'ultima Rete WiFi configurata ma considerando un'ambiente vergine, non rilevando parametri di configurazione nella scheda microSD passerà immediatamente allo step 2.
2. Scansione delle reti WiFi nelle vicinanze per salvare gli SSID e la tecnologia d'accesso (es. WPA2).
3. Instaurazione dell'access point(AP) con SSID `wifiRobot0df8` e password `Ab02er98?E` (parametri di default hard-coded). Successivamente sarà necessario dotarsi di uno smartphone o iPhone per collegarsi alla rete appena creata. 
4. Una volta connesso all'AP, basterà scansionare il QR Code presente nella scocca del robot per esser reinderizzati verso la pagina di configurazione di rete del robot dove verrà presentato un semplice form con un campo per selezionare la rete interessata tra le rilevate al passo 2 e un altro per la password. 
5. Quando il software riceverà i parametri di connessione, registrerà i parametri scrivendoli su file di configurazione .cfg nella microSD, chiuderà l'access point ed inizierà a connettersi alla rete WiFi fornita per un massimo di 4 tentativi con delay incrementale. Ad ogni avvio successivo, il software partirà con lo step 1 e leggendo i parametri SSID e password si connetterà alla rete indicata.

Quando il robot si sarà connesso con successo alla rete WiFi inizierà immediatamente a monitorare periodicamente il livello di carica della batteria per motivi precedentemente indicati e rimarrà in attesa di eventuali connessioni da parte dell'applicativo dedicato.

Il software del robot prevede 5 diverse modalità operative:
1. **Controllo Remoto** : controllo movimenti robot tramite App con algoritmo di self-protection attivo. Il robot rimane in ascolto di richieste HTTP per controllare gli attuatori. Alla ricezione di una richieste, questa verrà verificata e successivamente eseguita. I movimenti disponibili sono dei classici comandi WASD: avanti, retromarcia, ruotare a sinistra, ruotare a destra e fermarsi. Il comando può essere seguito da un periodo di delay il quale mantiene il movimento per un determinato periodo (in millisecondi) oppure instantaneo ergo immeditamente risolto. In questa modalità è attivo l'algoritmo di self-protection il quale si occupa di rimodulare il path del robot in caso di rilevazione di ostacoli.
2. **Blockly** : approcco con programmazione a blocchi in totale sicurezza tramite sezione dell'App dedicata. In modo similare a quanto accade per il Controllo Remoto, il web server attende richieste HTTP da codice generato dal workspace Blockly. Anche in questa modalità è attivo in background l'algoritmo di prevenzione delle collisioni per permettere una programmazione del robot in totale sicurezza.
3. **Random Walk** : Area Coverage Algorithm, un approccio randomico al problema di massima copertura di un'area data con risultato non deterministico. L'algoritmo prevede che il robot si muova di default in avanti con periodo indeterminato sino alla rilevazione di un ostacolo per via di un sensore frontale (ostacolo a meno di 100mm) o laterale (ostacolo a meno di 50mm). In tale circostanza il sistema si ferma per evitare la collisione, genera un nuova direzione scegliendo un angolo di rotazione casuale e prosegue per il nuovo path. Il software è in grado di riconoscere, grazie alle letture dei sensori, se la zona in cui si trova è riconducibile ad un angolo; se positivo procede arretrando per 100ms per poi ruotare di 360° e riprendere l'esecuzione.
4. **Boustrophedon** : Area Coverage Algorithm, il quale richiede l'assenza di ostacoli e un'area rettangolare per un funzionamento efficiente. Il concept essenziale è il modo in cui, da migliaia di anni, gli agricoltori lavorano i campi sin dall'era del bestiame fino ad oggi con le macchine moderne con sistemi più precisi e talvolta geolocalizzati. Quindi il robot, senza una mappa dell'area, partirà in direzione frontale alla velocità di default pre-impostata. Alla rilevazione di una superfie se questo non risulta esserne parallelo avvierà una veloce procedura di allineamento, possibile grazie ai sensori frontali assicurandosi che la differenza tra le letture dei due sia approssimabile allo zero. Qui verrà ridotta la velocità dei servomotori per assicurare maggiore precisione nei movimenti. Effettuerà una rotazione di 90°, si sposterà in avanti di una "unità robot" (21cm), ruoterà nuovamente di 90° in senso uguale alla precedente rotazione e, riattivando la velocità standard, riprenderà il movimento in avanti. Tale comportamento si ripeterà al prossimo perimetro dell'area rilevato e questa volta le rotazioni ad angolo retto avverrano in senso inverso alla precedente per progredire con l'obiettivo di copriere l'intera area in cui questo si trova ad operare.
5. **Spiral /w Wall follow** : Area Coverage Algorithm, soluzione adottata da sistemi Roomba® fino a non tanti anni fa. Quando inizia si noterà un pattern a spirale con raggio incrementale per coprire sempre più area sino alla rilevazione di un ostacolo. Quando verrà rilevata una superficie (o oggetto), il robot proseguirà mantenendo una distanza costante dal sensore laterale attivo per adempiere alla parte di "wall follow" , ossia seguire sino ad un angolo l'oggetto rilevato. In quest'ultima casistica il robot devierà verso una direzione calcolata come libera per riprendere il movimento a spirale. L'algoritmo è originariamente stato sviluppato sulle basi di uno studio dell'MIT sul comportamento degli animali e su come questi si comportano in diverse aree riguardo alla ricerca di cibo. Quando si osservano gli spostamenti di formiche o api in natura alla ricerca di nuove zone si noteranno forti analogie con l'algoritmo in questione, ovviamente non strettamente rispettato data la natura implementativa dell'algoritmo.

### Algoritmo di Self-Protection ###
L'algoritmo di prevenzione delle collisioni impiegato durante le prime due modalità sopra citate implementa la tecnica Bubble Band. Proposto da Khatib e Quinlan, questo metodo definisce una "bolla" contenente il massimo spazio libero attorno alla struttura del robot disponibile per spostarsi in ogni direzione con l'assicurazione di non incontrare ostacoli. La dimensione e forma della bolla è determinata dal modello geometrico del robot e dal range di sensibilità fornito dai sensori in quanto la posizione di questi approssima il perimetro del robot. In questo caso si è impostato un range di 5cm dal perimetro del robot come area bubble band sicura. Tale modello è stato espanso introducendo un sistema di rilevazione del Livello di prossimità di un ostacolo dal robot. Sono stati definiti 3 Livelli di rilevazione: 
- **L3** : direzione libera da ostacoli entro il limite imposto dal sensore interessato.
- **L2** : oggetto rilevato tra 10-15cm.
- **L1** : oggetto rilevato entro 10cm.

Durante il movimento del robot i livelli vengono constantemente aggiornati. Ogni lettura dei sensori va ad aggiornare l'array `short levels[4] = {3, 3, 3, 3};` il quale definisce il Livello per ogni lato del robot: `{front_right, front_left, side_right, side_left}`. Quest'informazione sarà utile per la parte decisionale dell'algoritmo nel ri-modulare il proprio andamento. Infatti il percorso del robot varierà sulla base dell'analisi dei Livelli, un pò come l'approccio di un veicolo di Braitenberg. Un veicolo di Braitenberg è generalmente un agente il quale può muoversi autonomamente in un'area basandosi unicamente sugli input dei sensori di cui è dotati. Le ruote (coadiuvate dai motori) fungono da attuatori e nella configurazione più semplice adottabile queste sono direttamente collegate ai sensori in modo che un segnale di quest'ultimi produca immediatamente un effetto sul movimento della ruota stessa. Ritornando all'algoritmo di self-protection, in ogni istante le decisioni prese dipenderanno direttamente dal Livello dei sensori:
```
se almeno 1 elemento in levels[] è <= 2 :
    attiva flag lv_medio
altrimenti se almeno 1 elemento in levels[] è <= 1 :
    attiva flag lv_basso

se lv_medio è VERO :
    riduci velocità all'80%
se lv_basso è VERO :
    evita ostacolo
    riprendi direzione libera
```
Quindi se in un istante si rileva un Livello 2 si procede riducendo la velocità di movimento, se presente anche un Livello 1 l'algoritmo evita l'ostacolo ruotando il robot con angoli incrementali con funzione dipendente dalla distanza dall'oggetto e riprende l'ultimo movimento noto nella direzione libera individuata, ergo Livello 3, riprendendo la massima velocità.

### Web Server ###
La gestione delle richieste HTTP è affidata al web server instaurato sfruttando la liberia **WiFiNINA**. Le API a disposizione sono di basso livello pertanto non è possibile un approccio simile ad altri linguaggi o tecnologie che più si prestano all'instaurazione di web service quali *nodejs*, *golang* e altri. Infatti è quasi obbligata la scelta di leggere byte per byte la richiesta in entrata (`char c = client.read();`). Questa grande limitazione motiva la scelta di sfruttare la libreria **Regexp** per filtrare le varie richieste, analizzando le linee lette tramite espressioni regolari. Di seguito una tabella che riassume tutte le richieste HTTP che il web server Arduino prende in gestione:

URL | Descrizione
------------ | ------------- |
`POST /api/motors/forward?delay=<millis>&auth=<authcode>` | movimento in avanti per `<millis>`ms
`POST /api/motors/left?delay=<millis>&auth=<authcode>` | rotazione a sinistra per `<millis>`ms
`POST /api/motors/right?delay=<millis>&auth=<authcode>` | rotazione a destra per `<millis>`ms
`POST /api/motors/backward?delay=<millis>&auth=<authcode>` | movimento in retromarcia per `<millis>`ms
`POST /api/motors/stop?auth=<authcode>` | stop dei servomotori da qualsiasi movimento corrente
`POST /api/motors/speed?value=<speed_1_to_5>&auth=<authcode>` | imposta velocità servomotori con valore scalato da 1-5 a 0-255 (PWM)
`POST /api/connect` | connessione al robot per ricevere codice autenticativo necessario per la comunicazione con questo
`POST /api/disconnect?auth=<authcode>` | disconnessione dal robot
`POST /api/setmode?op=<opmode_-1_to_4>&auth=<authcode>` | impostazione della modalità operativa 
`GET /api/sensors/battery?auth=<authcode>` | recupero tensione e livello batteria
`GET /api/sensors/<sharp_sensor>?auth=<authcode>` | recupero lettura sensori frontali e laterali
`POST /api/ping?auth=<authcode>` | richiesta periodica con periodo 10s per verificare la connessione tra i due agenti

Un esempio di richiesta HTTP autorizzata che include il cambio di operatività in modalità standby (-1):

`POST /api/setmode?op=-1&auth=9273`

e la rispettiva espressione regolare da verificare per riconoscerla:

`POST( )%/api%/setmode%?op=(.+)&auth=(%d+)( )HTTP%/1%.1`

Per quanto riguarda la modalità **Access Point**, il web server instaurato a differenza di quando già connesso ad una rete wireless, espone 2 servizi: 

URL | Descrizione
------------ | ------------- |
`GET /` | restituisce pagina HTML con form per connessione a rete WiFi
`POST /wificonnect?network=<ssid>&password=<password>` | avvia procedura di salvataggio dei parametri della rete su microSD ed inizializza connessione robot alla nuova rete `<ssid>`

E' possibile collegare il robot solamente ad 1 dispositivo alla volta per evitare comportamenti inaspettati e mantenere una consistenza tra i comandi richiesti.

Per assicurare un funzionamento controllato è stato implementato un *watchdog* software tramite sistema di richieste ping temporizzate. L'App invia una richiesta HTTP ping periodicamente con campo `body` vuoto (per risparmiare sui tempi d'invio ed elaborazione), il software del robot quando riceverà tale richiesta registrerà il timing corrente. In ogni istante viene controllata l'ultima rilevazione e se risultano essere passati più di 10 secondi la comunicazione wireless viene interrotta e il robot passa in modalità standby, impostando a default ogni parametro di funzionamento. Rimanendo quindi pronto ad accettare nuove richieste di connessione.

------------------------------------------

## Applicativo ##

Per realizzare l'App dedicata all'interazione con il robot si è sposata la tecnologia **React Native**, un potente e moderno framework mantenuto da Facebook assieme ad una ricca community per scrivere applicazioni native utilizzando React.

Come piattaforma di sviluppo si è sfruttato **Expo**, un set di strumenti e servizi costruiti e pensati attorno a React Native e piattaforme native che semplificano lo sviluppo, build e deploy di app iOS, Android e Web App dalla stessa sorgente di codice JavaScript/TypeScript.

Per installare gli strumenti da linea di comando Expo:

`npm install --global expo-cli`

E successivamente per inizializzare il progetto:

`expo init robotics-remote`

