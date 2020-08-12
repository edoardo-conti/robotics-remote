# 🎓 Progetto di Laurea  #

## Introduzione ##

Progetto open-source finalizzato alla realizzazione di un robot domestico stampato in 3D controllabile da remoto con supporto alla programmazione a blocchi tramite applicazione dedicata per iOS ed Android.
* **Autore: Edoardo Conti [278717]**
* **Titolo Tesi: Progetto open-source di robot domestico con supporto alla programmazione a blocchi per scopi didattici**

------------------------------------------

## Architettura Robot e Scelte Implementative ##

Di seguito la componentistica principale dell'hardware del robot:

- Il microcontrollore impiegato è un **Arduino UNO WiFi Rev2** che differisce dalla versione classica per il nuovo chip *ATmega4809* (il classico *Arduino UNO R3* è coadiuvato da microcontrollore *ATmega328*) e la dotazione di un modulo SoC con integrato uno stack *TCP/IP* completo il quale può offrire accesso ad una rete WiFi oppure agire come Access Point. 
- La scelta della ventola d'aspirazione, dopo svariate valutazioni, è ricaduta sul seguente modello: AVC BA10033B12S da 12V 2.85A . L'assorbimento si attesta attorno ai 34W ed è più che accettabile per assicurare un'autonomia al robot di circa 30min.
- Il circuito per gestire la ventola è basato su [MOSFET IRL7833PBF](https://www.infineon.com/dgdl/irl7833pbf.pdf?fileId=5546d462533600a4015356600d71257b) con rating 30V e 150A, più che sufficiente per reggere il carico elettrico richiesto.
- Gli spostamenti sono assicurati da due motori [Micro Metal Gearmotor HPCB 6V](https://www.pololu.com/file/0J1487/pololu-micro-metal-gearmotors-rev-4-2.pdf) con ratio 298:1 .
- I servomotori sono gestiti da due driver [DRV8838](https://www.ti.com/lit/ds/symlink/drv8838.pdf), uno per ogni motore per assicurare un'erogazione continua massima di 1.7A (peak = 1.8A) in 0-11V.
- Per la rilevazione di ostacoli, il robot vanta di un'array di 4 sensori di prossimità Sharp IR: 2 frontali con range di sensibilità 4-30cm ([GP2Y0A41SK0F](https://global.sharp/products/device/lineup/data/pdf/datasheet/gp2y0a41sk_e.pdf)) e 2 laterali con range di sensibilità 2-15cm ([GP2Y0A51SK0F](https://global.sharp/products/device/lineup/data/pdf/datasheet/gp2y0a51sk_e.pdf)). Nell'eventualità di un fallimento dei sensori nel rilevare ostacoli, nella parte frontale centrale del robot è presente un microswitch a levetta che funge da bumper.
- L'alimentazione è assicurata da una batteria LiPo "ZIPPY Compact" da 1300mAh da 12V (3S). La misurazione del livello di carica è realizzata con un partitore di tensione, un tipo di circuito costituito da due o più componenti passivi collegati in serie ai capi dei quali, se viene applicata una tensione, essa si ripartirà sulle stesse componenti in base al loro valore. Questo renderà possibile leggere la tensione d'alimentazione tramite pin analogico accertandosi che il segnale rientri tra la `Vref` (5V) di Arduino in modo da non danneggiare la scheda. 
- Dato il range di tensioni raccomandate per alimentare l'Arduino UNO WiFi Rev2 tramite pin dedicato `Vin` (7-12V) è stato impiegato un regolatore di tensione DC-DC [LM2596S-ADJ](https://www.ti.com/lit/ds/symlink/lm2596.pdf?ts=1595681936647&ref_url=https%253A%252F%252Fwww.google.com%252F) per convertire la tensione in entrata dalla batteria compresa tra 10.5V e 12.6V a 8V stabili (il range di voltaggio in INPUT è approssimabile come proporzionale al livello di carica della batteria stessa).  
- La struttura è stata stampanta in 3D con materiale PETG per una buona resistenza agli urti rispetto ad eventualmente un classico PLA. Il modello misura 21x21x6.5cm e sono state necessarie circa 18 ore per completare la stampa ad una velocità di 50mm/s con una Anet A8. (Crediti: [Cesar Nieto](https://www.thingiverse.com/cesnietor/designs))

Si è inoltre optato per l'impiego di un paio di [encoder magnetici](https://www.pololu.com/file/0J815/TLE4946-2K.pdf) per calcolare con precisione le rotazioni dei servomotori ed assicurare precisione dimensionale nei movimenti. Purtroppo non è stato possibile sfruttarli, causa malfunzionamento di uno dei due componenti. Pertanto sono stati utilizzati nel circuito al solo scopo di alimentare i due servomotori, senza sfruttare i pin sensoriali del conteggo di tick e verso di rotazione. La sostituzione del componente difettoso (con conseguente implementazione via software degli encoders) è sicuramente un ottimo candidato da inserire nella lista di upgrade futuri.

Per dotare il Single-Board Computer(SBC) Arduino di storage permanente si è installato un lettore di schede microSD il quale ha richiesto, dato il diverso microcontrollore dalla SBC classica Arduino Uno, l'impiego dell'header ICSP. Grazie a questa aggiunta è possibile salvare in modo permanente e consistente i parametri di connettività alla rete WiFi.

Di seguito una tabella riassuntiva delle linee d'alimentazione:
Batteria (10.5-12.6V) | Regolatore DC-DC (8V) | Arduino (3.3V) | Arduino (5V)
------------ | ------------- | ------------- | -------------
| Regolatore DC-DC | Arduino `Vin` | 2x Logica driver DRV8838 (`Vcc`) | 2x Sharp GP2Y0A41SK0F  |
| Driver MOSFET Ventola | 2x Driver DRV8838 per servomotori (`VM`)  | - | 2x Sharp GP2Y0A51SK0F |
| - | - | - | Lettore Schede microSD |

Per limitare il rumore nelle letture dei sensori di prossimità IR si è stabilizzato la linea d'alimentazione con un filtro di 2 condensatori tra linea e GND (100µF e 100nF) e 1 resistore nel pin del segnale in uscita. Purtroppo questi due prodotti sono risultati eccessivamente rumorosi ed inclini a generari segnali peak, il quale implicano un numero importante di falsi positivi. Per una futura rivisitazione (state of the art) del progetto sarebbe opportuno valutare moduli LIDAR (Time-Of-Flight). (sorgente: https://www.robotshop.com/community/forum/t/how-to-improve-sharp-gp2dxxx-sensors/12989)

Di seguito le schematiche del circuito elettrico prodotte con KiCad: (**TODO**: da rivedere)
![kicad_schematics](https://i.imgur.com/KBY2GHU.png)

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
1. Tenterà di collegarsi alla Rete WiFi configurata sul file `SETTINGS.CFG` in scheda microSD. Assumendo questo come primo avvio e non rilevando quindi parametri di configurazione, passerà immediatamente allo step 2.
2. Scansione delle reti WiFi nelle vicinanze per salvare gli SSID e la tecnologia d'accesso (es. WPA2).
3. Instaurazione dell'access point(AP) con SSID `wifiRobot0df8` e password `Ab02er98?E` (parametri di default hard-coded). Successivamente sarà necessario dotarsi di uno smartphone o iPhone per collegarsi alla rete appena creata. 
4. Una volta connesso all'AP, basterà scansionare il QR Code presente nella scocca del robot per esser reinderizzati verso la pagina di configurazione di rete del robot dove verrà presentato un semplice form con un campo per selezionare la rete interessata tra le rilevate al passo 2 e un altro per la password. 
5. Quando il software riceverà i parametri di connessione, registrerà i parametri scrivendoli su file di configurazione .cfg nella microSD, chiuderà l'access point ed inizierà a connettersi alla rete WiFi fornita per un massimo di 4 tentativi con delay incrementale. Ad ogni avvio successivo, il software partirà con lo step 1 e leggendo i parametri SSID e password si connetterà alla rete indicata.

![arduino_ap_steps](https://i.imgur.com/Ej5DGEG.png)

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
La gestione delle richieste HTTP è affidata al web server instaurato sfruttando la liberia **WiFiNINA**. Le API a disposizione sono di basso livello pertanto non è possibile un approccio simile ad altri linguaggi o tecnologie che più si prestano all'instaurazione di web service quali *nodejs*, *golang* e altri. Infatti è quasi obbligata la scelta di leggere byte per byte la richiesta in entrata (`char c = client.read()`). Questa grande limitazione motiva la scelta di sfruttare la libreria **Regexp** per filtrare le varie richieste, analizzando le linee lette tramite espressioni regolari. Di seguito una tabella che riassume tutte le richieste HTTP che il web server Arduino prende in gestione:

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

Per realizzare l'App dedicata all'interazione con il robot si è sposata la tecnologia **React Native (RN)**, un potente e moderno framework mantenuto da Facebook assieme ad una ricca community per scrivere applicazioni native utilizzando React.

Come piattaforma di sviluppo si è sfruttato **Expo**, un set di strumenti e servizi costruiti e pensati attorno a React Native e piattaforme native che semplificano lo sviluppo, build e deploy di app iOS, Android e Web App a partire dalla stessa sorgente di codice JavaScript/TypeScript.

### Sviluppare App native con Expo ###

Per installare gli strumenti da linea di comando Expo:

`npm install --global expo-cli`

E successivamente per inizializzare il progetto:

`expo init robotics-remote`

L'applicazione è stata sviluppata per essere cross-platform e quindi disponibile sia per iOS che Android. I requisiti minimi richiedono una versione di Android 5+ e di iOS 10+ . Expo prevede due diversi approcci per creare applicazioni: Workflow Managed o Bare.
Il workflow Managed permette di scrivere app native utilizzando solamente JavaScript/TypeScript, gli strumenti e servizi Expo si occupano di tutto il resto a basso livello per le piattaforme native. Infatti per sfruttare funzionalità native dei dispositivi si utilizza l'SDK Expo e le librerie offerte dalla community.
Invece con il workflow Bare si ha pieno accesso ad ogni aspetto di un progetto nativo a discapito della mancanza di diversi servizi Expo.
Non avendo particolari necessità si è optato per un workflow Managed assicurandosi un pieno supporti ai servizi Expo. Tale scelta è motivata anche dal fatto che se in futuro fosse stato necessario scrivere del codice nativo o implementare librerie native sarebbe stato comunque possibile farlo grazie al comando `expo eject`. Quest'ultimo genera 2 directory *ios* e *android* rispettivamente per ogni sistema operativo contententi il progetto nativo. Sarebbe bastato quindi aprire le cartelle con Xcode o Android Studio e proseguire lo sviluppo con l'ambiente di sviluppo nativo.

Lo sviluppo risulta essere estremamente lineare grazie agli strumenti a disposizione, così da concentrarsi unicamente sul prodotto da realizzare senza perdere tempo dietro a problemi derivanti dall'ambiente di sviluppo. E' possibile consultare constantemente il progetto aprendolo all'interno dell'App Expo disponibile sia per iOS e Android che funge da client, nel proprio web browser oppure in un simulatore installato localmente nella macchina (quest'ultima opzione richieste Xcode / Android Studio in base al dispositivo che si desidera emulare).

Per installare moduli aggiuntivi è sufficiente il comando `expo install <nome_modulo>` il quale sfrutta il package manager *yarn* per la gestione dei pacchetti.

Una volta giunti ad un checkpoint nella timeline del progetto è possibile pubblicare l'applicazione all'interno dei servizi Expo per condividerla con altri utenti.
Il comando dedicato è `expo publish` il quale comprimerà il codice, effettuerà il build del bundle Javascript generando 2 versioni del codice (una per iOS l'altra per Android) e le caricherà assieme a tutti gli assets su una Content Delivery Network (CDN).
L'utente che tenterà di accedere all'app tramite il client Expo riceverà la versione adeguata in base alla versione dell'SDK Expo impiegato, piattaforma e canale di rilascio. Quest'ultima funzionalità è molto utile per condividere versioni dell'applicativo con differenti configurazioni per diversi utenti. Ad esempio in questo caso è stato utile creare un canale `standalone` per distribuire una versione dell'applicazione indipendente, quindi fruibile senza necessario bisogno di connettersi fisicamente al robot.

Per ultimo, per compilare il progetto e generare le rispettive applicazioni native è sufficiente il comando `expo build:[ios/android]`. Per iOS è necessario essere registrati al programma *Apple Developers* ed autenticarsi con le proprie credenziali da sviluppatore. Per Android è sufficiente il fetch del keystore ed il build è gratuito.

### Panoramica App Nativa ###
L'applicazione si presenta con una schermata iniziale che richiede di connettersi al robot per poterlo controllare. Si ricorda che è necessario che sia lo smartphone che robot siano collegati alla stessa rete WiFi. Premuto il bottone di connessione, l'app invierà una richiesta HTTP `POST /api/connect` al robot e se questo non è collegato a nessun altro dispositivo accetterà la richiesta e restituirà il codice autenticativo, necessario per inoltrare le richieste future.

La schermata quindi passarà alla dashboard dove, come prima opzione, sarà possibile controllare il robot inviando comandi di spostamento in avanti, indietro, ruota a sinistra o destra. Appena connesso, il robot, non attiva l'algoritmo di prevenzione degli ostacoli. Questo per evitare movimenti bruschi dovuti ad un ambiente non ancora idoneo, verrà attivato immediatamente dopo la prima richiesta di movimento, o meglio prima di risolvere la prima richiesta di movimento per assicurare totale protezione sin dal primo movimento.

Quindi durante l'intero periodo di attività, il software del robot sarà constantemente all'allerta di ostacoli per un funzionamento in totale sicurezza. Nel caso in cui si richieda uno spostamento il quale però non risulti essere disponibile in quanto implicherebbe un ostacolo all'interno della "bolla" del robot, un'animazione avverità di tale rilevazione e il movimento richiesto non verrà effettuato. 

Scorrendo l'applicazione, più sotto è possibile consultare le condizioni d'alimentazione che mostrano tensione della batteria e livello stimato di carica.

Successivamente sono presenti due bottoni che permettono di accedere alle funzionalità principali dell'applicativo: 
- **Blockly**, per un approccio al robot con paradigma di programmazione a blocchi
- **Modalità Esplorazione**, per avviare algoritmi di massima copertura di un'area ed osservare i diversi comportamenti

In fondo, come ultima opzione, il bottone per disconnettersi dal robot e lasciarlo libero per un'eventuale nuova connessione.

![app_dashboard](https://i.imgur.com/e3mbZaN.png)

### Programmazione a blocchi per istruire il Robot ###
In questa sezione dell'App è possibile approcciarsi al mondo della programmazione a blocchi per istruire il robot con svariati comandi a disposizione sfruttando **Blockly**. Blockly è una raccolta di librerie per la creazione di linguaggi ed editor di programmazione visiva basati su blocchi. È un progetto di Google ed è un software gratuito e open source rilasciato sotto licenza Apache 2.0 .

Purtroppo, dato il mancato supporto alle librerie js come assets Android, non è stato possibile implementare tale servizio in locale. Per ovviare al problema si è deciso di ospitare il codice sorgente della pagina Blocky su *Fast.io* , una piattaforma moderna di file hosting. La pagina web principale (`index.html`) è caricata nell'App sfruttando il componente `WebView` di React Native. Qui nasce un ulteriore problema, più nello specifico un ostacolo a livello di networking. Infatti la rete del robot e della pagina da dove è caricato Blockly sono, per ovvie ragioni, differenti e quindi risulterà impossibile inviare richieste HTTP al web server Arduino per controllare il robot. La soluzione che è stata adotatta è resa disponibile direttamente dal componente WebView il quale espone metodi di comunicazione tra RN e pagina web caricata attraverso l'injection di metodi Javascript nella pagina destinazione. Ecco quindi che è possibile chiamare dal codice sorgente Javascript di Blockly da dominio fast.io funzioni come `window.ReactNativeWebView.postMessage()` il quale inviano appunto messaggi all'applicativo React Native intercettabili tramite *prop* dedicato (`onMessage`) del componente. Il workaround appena introdotto è sfruttato per inviare messaggi che richiedono l'invio di determinate richieste HTTP da parte dell'App che ovviamente si trova nella stessa rete del robot. Facile intuire quindi che l'esecuzione del codice del workspace generato tramite Blockly riguardo all'inoltro di comandi al robot si traducono in chiamate `window.ReactNativeWebView.postMessage(<json_richiesta_http>)` dove come parametro viene passato del JSON che includa l'URL della richiesta HTTP ed eventuali parametri come ad esempio il delay di uno spostamento. 

L'interfaccia vanta di una toolbar dal quale è possibile scegliere e posizione all'interno del workspace blocchi funzionali divisi per categorie d'appartenenza. Al momento sono disponibili blocchi delle seguenti categorie: Logic, Loops, Math, Text, *Robot*(custom) e Variables.
Per posizionare un blocco all'interno del workspace è sufficiente aprire la categoria interessata, selezionare il blocco e trascinarlo all'interno del workspace per poi rilasciare la pressione. Lo spazio è stato configurato per allineare blocchi ad una griglia fantasma in modo da offrire uno "snap" ordinato dei blocchi. Nella parte superiore destra si trova il cestino, dove è possibile trascinare blocchi o insieme di blocchi non più necessari per rimuoverli dallo spazio di lavoro (se cliccato è possibile accedere ai blocchi nel cestino per recuperarli). Subito più sotto comandi per gestire lo zoom del workspace per adattarsi alle dimensioni di questo, sono disponibili: zoom in, zoom out e zoom adattivo in base ai blocchi.

Di seguito i blocchi disponibili nella categoria custom Robot:
- Avanti/Indietro per `X`s
- Rotazione sinistra/destra per `X`(s|°) 
- Accendere/Spegnere ventola d'aspirazione
- Lettura sensore frontale (sinistro/destro) o laterale (sinistro/destro)
- Impostazione velocità a `X` (1 <= `X` <= 5)
- Attendere `X`s
    
Nella barra di navigazione dell'applicazione, a destra sono presenti 2 bottoni: uno per generare il codice dal workspace (build) l'altro per aprire il menù opzioni (options). Quest'ultimo permette di ricaricare la pagina Blockly oppure pulire il workspace con un semplice tap.

Premendo il bottone con l'icona di un martello (build), a patto che il workspace non sia vuoto, verrà generato il codice Javascript e presentato attraverso un *Modal*. Il codice verrà stampato all'interno di un Syntax Highlighter, il quale appunto, formatterà il codice a dovere ed applicherà degli stili per una consultazione facilitata e più chiara. Se sufficiente si potrà chiudere il Modal attraverso il semplice tasto dedicato (Chiudi) oppure eseguire il codice in questione attraverso il tasto "Esegui Codice". L'esecuzione del codice Javascript è resa possibile grazie alla funzione nativa `eval()`. Qualora il codice preveda la comunicazione con il robot, casistica altamente probabile, le richieste HTTP verranno inoltrate seguendo il workaround più sopra descritto. 

Come durante il Controllo Remoto, nel caso in cui il robot incontri degli ostacoli durante gli spostamenti invocati dai comandi generati dai blocchi, si occuperà di evitarli in totale sicurezza riprendendo poi l'esecuzione del codice corrente.

Quando si abbandonerà la schermata Blockly, il workspace corrente verrà automaticamente salvato in locale nell'applicazione per poi essere recuperato ad ogni nuovo  accesso alla sezione in questione.

### Panoramica Algoritmi di Area Coverage ###
In questa parte dell'applicativo è possibile lanciare l'esecuzione di un algoritmo di massima copertura dell'area ed osservare i vari comportamenti. Gli algoritmi a disposizione sono stati illustrati in **Modalità Operative** : Random Walk, Boustrophedon e Spiral. 

Ogni tab metterà a disposizione una breve introduzione all'algoritmo ed un comodo pulsante per avviare la navigazione autonoma. Dopo aver premuto quest'ultimo partità un countdown di 3 secondi per poi inviare la richiesta HTTP di impostazione della modalità operativa corrispendente all'algoritmo di interesse. Ricevuta conferma, il robot inizierà a muoversi applicando le regole imposte dall'algoritmo scelto. Ovviamente in questi scenari la funzionalità di prevenzione delle collisioni non viene attivata in quanto adrebbe ad influire sulle regole, nonchè comportamenti, che definiscono l'algoritmo in esecuzione.
Qualora si volesse terminare l'esecuzione è possibile farlo grazie ad il comodo bottone "Ferma Robot" che apparirà al posto di "Avvia Navigazione Autonoma".
