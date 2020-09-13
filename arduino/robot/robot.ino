#include <Battery.h>
#include <SharpDistSensor.h>
// Funzionalità WiFi
#include <SPI.h>
#include <WiFiNINA.h>
// microSD
#include <SDConfigCommand.h>
// Espressioni Regolari
#include <Regexp.h>

/*
   microSD
   @CHIPSELECT, pin cs del microSD Reader
   @SETTING_FILE, nome file di configurazione
*/
#define CHIPSELECT 10
#define SETTING_FILE "settings.cfg"

// @BATT_PIN, pin del voltage-divider per conversione tensione max batteria da 12V a 5V (tolleranza pin scheda)
#define BATT_PIN A0

// Definizioni per identificare tipo di richiesta HTTP
#define MOTORS_FORWARD_DELAY  0x0000
#define MOTORS_LEFT_DELAY     0x0001
#define MOTORS_RIGHT_DELAY    0x0010
#define MOTORS_BACKWARD_DELAY 0x0011
#define MOTORS_STOP           0x0100
#define MOTORS_SET_SPEED      0x0101
#define ROBOT_CONNECT_REQ     0x0111
#define ROBOT_DISCONNECT_REQ  0x1000
#define ROBOT_SET_MODE        0x1001
#define ROBOT_GET_BATTERY     0x1010
#define ROBOT_GET_SENSORS     0x1011
#define ROBOT_GET_PING        0x1100
#define ROBOT_SET_FAN         0x1101
#define ROBOT_SET_BLOCKLY     0x1110

// Variabili per lo storing di paramatri ssid e psw di rete
char cfg_ssid[16];
char cfg_pass[16];
char cfg_ap_ssid[16];
char cfg_ap_pass[16];
// istanza di SDConfigCommand per la gestione dei parametri di configurazione permanenti in microSD
SDConfigCommand sdcc;

/*
   WiFi
   [@status | @server], parametri rete WiFi principale unità robot
   [@status_ap | @server_ap], parametri rete WiFi "fail-safe" da instaurare in caso di fallita connessione a rete principale
   nota: socket differente NECESSARIO (porte :80 vs :8080) per permettere l'inizializzazione di entrambi senza spegnere l'unità robot
*/
int status = WL_IDLE_STATUS;
WiFiServer server(80);
int status_ap = WL_IDLE_STATUS;
WiFiServer server_ap(8080);
// codice alfanumerico (4) generato in runtime per l'autenticazione delle richieste HTTP via WiFi
int connection_req_auth = -1;
// flag per dividere l'operatività in loop() in base alla configurazione dell'ambiente di rete (WiFi vs AP)
bool wifi_ap_mode = false;
// numero di reti wireless individuate nelle vicinanze (modalità AP)
short numSsid;
// array di ssid di reti wireless individuate nelle vicinanze (max 16) (modalità AP)
String networks[16];

/*
   Sensori IR Sharp
   @sensorPin_fl, pin analogico sensore frontale sinistro   (GP2Y0A41SK0F)  (4-30cm)
   @sensorPin_fr, pin analogico sensore frontale destro     (GP2Y0A41SK0F)  (4-30cm)
   @sensorPin_sr, pin analogico sensore laterale destro     (GP2Y0A51SK0F)  (2-15cm)
   @sensorPin_sl, pin analogico sensore laterale sinistro   (GP2Y0A51SK0F)  (2-15cm)
   [@distance_fl, @distance_fr], lettura distanze in millimetri(intero) dei sensori frontali
   [@distance_sr, @distance_sl], lettura distanze in millimetri(intero) dei sensori laterali
*/
const byte sensorPin_fl = A1;
const byte sensorPin_fr = A2;
const byte sensorPin_sr = A3;
const byte sensorPin_sl = A4;
// dimensione finestra filtro mediano calcolato su lettura sensori (numero dispari | 1 => nessun filtraggio)
const byte medianFilterWindowSize = 3;
// istanze di SharpDistSensor per ogni sensore sopra descritto
SharpDistSensor sensor_fl(sensorPin_fl, medianFilterWindowSize);
SharpDistSensor sensor_fr(sensorPin_fr, medianFilterWindowSize);
SharpDistSensor sensor_sr(sensorPin_sr, medianFilterWindowSize);
SharpDistSensor sensor_sl(sensorPin_sl, medianFilterWindowSize);
// distanze rilevate dai sensori ir, inizializzate con il valore limite superiore
unsigned short distance_fl = 300;
unsigned short distance_fr = 300;
unsigned short distance_sr = 150;
unsigned short distance_sl = 150;

/*
   PIN Digitali
   @fan_mosfet, pin MOSFET ventola d'aspirazione (todo: non in uso)
   @bumper, pin switch con levetta frontale in caso di fallita rilevazione dei sensori
   [@m1_ph | @m1_en], pin "phase" ed "enable" del motore di destra
   [@m2_ph | @m2_en], pin "phase" ed "enable" del motore di destra
   @green_led, pin LED verde principali posto su lato superiore robot
*/
const short fan_mosfet = 6;
const short bumper = 7;
const short m1_ph = 2;
const short m1_en = 3;
const short m2_ph = 4;
const short m2_en = 5;
const short green_led = 13;

/*
   Velocità PWM per i micro metal motors
   180pwm -> 1100ms = 21cm (roboUnit) in avanti | 700ms = 90° turn
   @default_speed, velocità di default iniziale
   @m_speed, velocità corrente dei motori
*/
const uint8_t default_speed = 180;
uint8_t m_speed = 180;

/*
   Gestione alimentazione batteria LiPo (1300mAh 11.1V 3S)
   @battEmpty,  : 3.5V x 3 = 10.5V = 10500mV
   @battFull,   : 4.2V x 3 = 12.6V = 12600mV (todo -> misurata: ____)
   @is_battery_charged, flag di sicurezza del livello di carica
   @battery, istanza di Battery per il monitoraggio della carica durante l'esecuzione del programma
   nota: 3.5V è un valore limite convenzionalmente accettato come sicuro, MAI scendere sotto i 3V in una singola cella (9V se batteria 3S).
*/
const int batt_empty  = 10500;
const int batt_full   = 12600;
bool is_battery_charged = false;
Battery battery = Battery(batt_empty, batt_full, BATT_PIN);

/*
   Timers
   1. Batteria, controllo del livello di carica della batteria ogni 10s
   2. (debug)selfProtectAlgo, controllo livelli sensori ogni 2s (todo: da rimuovere in futuro)
*/
// Battery
unsigned long currentMillis_battery;
unsigned long prevMillis_battery = 0;
unsigned long interval_battery = 10000; // 10s
// selfProtectAlgo
unsigned long currentMillis_algo;
unsigned long prevMillis_algo = 0;
unsigned long interval_algo = 2000; // 2s
// Ping-Pong
unsigned long clientLastReqMillis_ping = 0;
unsigned long currentMillis_ping;
unsigned long prevMillis_ping = 0;
unsigned long interval_ping = 20000; // 20s
bool updatecurrentMillisPing = false;

/*
   @behaviour_selector, selettore algoritmi in esecuzione nel programma loop()
    0. Controllo Remoto (gestione movimenti robot, tramite App)
    1. Blockly (approcco programmazione a blocchi, tramite app)
    2. Random Walk (Coverage Algorithms)
    3. Boustrophedon (Coverage Algorithms)
    4. Spiral /w Wall follow (Coverage Algorithms)
*/
short behaviour_selector = -1;

/*
   @last_remote_direction, storing dell'ultima direzione inviata dal controllo remoto
   nota: -1 -> nullo | 0 -> avanti | 1 -> sinistra | 2 -> destra | 3 -> indietro | 4 -> stop
*/
short last_remote_direction = -1;

/*
   Bubble-Band
   @self_protection_enabled, flag che abilita l'algoritmo(Bubble-Band) di protezione da collissioni con ostacoli, attivato dopo primo comando ricevuto da controllo remoto.
   @bubbleBandBounds, definizione dimensioni bubble
   @front_ranges, range per definizione livelli da sensori frontali
   @side_ranges, range per definizione livelli da sensori laterali
   @levels, livelli per ogni sensore. [intero positivo][1-3]
   @lv_medium, rilevato almeno un livello 2 in @levels
   @lv_low, rilevato almeno un livello 1 in @levels
   @corner, rilevazione angolo
   @wasBBXon, flag notifica intervento algoritmo durante esecuzione programma Blockly
*/
bool self_protection_enabled = false;
int bubbleBandBounds[2] = {50, 50};
// ranges
short front_ranges[2] = {100, 150};
short side_ranges[2] = {40, 120};
short levels[4] = {3, 3, 3, 3};
short corner = 0;
short wasBBXon = 0;
bool lv_medium = false;
bool lv_low = false;

/*
   Variabili per gestione algoritmi di "area coverage"
   @randomWalk_count, utile a rilevare angoli durante navigazione "random-walk"
*/
short randomWalk_count = 0;
short boustrophedon_counter = 0;
short boustrophedon_diff = 0;
bool boustrophedon_parallel = false;

/*
   Utility
   @round5delta, utile per arrotondare numero al multiplo di 5 più vicino
   @ms, istanza MatchState per sfruttare le espressioni regolari per identificare richieste HTTP
   @incomingByte, gestione comunicazione seriale, utilizzata per funzionalità di debug (todo: da rimuovere in futuro).
   @bumper_status, monitoraggio status switch a levetta frontale
   @rand_number, variabile d'appoggio per generazione numero random
*/
static signed char round5delta[5] = {0, -1, -2, 2, 1};
MatchState regexp;
int incomingByte = 0;
byte bumper_status = LOW;
long rand_number;


void setup() {
  /*
     Inizializzazione pin I/O
  */
  // LED verde principale
  pinMode(green_led, OUTPUT);
  // MOSFET ventola
  pinMode(fan_mosfet, OUTPUT);
  // motore 1
  pinMode(m1_ph, OUTPUT);
  pinMode(m1_en, OUTPUT);
  // motore 2
  pinMode(m2_ph, OUTPUT);
  pinMode(m2_en, OUTPUT);
  // bumper
  pinMode(bumper, INPUT_PULLUP);

  // Inizializzazione comunicazione seriale
  Serial.begin(9600);
  // (wait for serial port to connect. Needed for native USB port only)
  while (!Serial) { }

  /*
     ############################## INIZIO: microSD ##############################
  */
  // debug: riscrittura file
  // microsd_debug();

  // inizializzazione gestione microSD
  while ( !(sdcc.set(SETTING_FILE, CHIPSELECT, process_cfg)) ) {}

  // Display the setting.cfg in Serial Monitor
  //sdcc.openInSerial();
  //Serial.println();

  // Lettura ed elaborazione comandi da file di configurazione
  sdcc.readConfig();
  /*
     ############################### FINE: microSD ###############################
  */


  /*
     ############################### INIZIO: WiFi ################################
  */
  int arduino_connected = connectToNetwork(cfg_ssid, cfg_pass, 5);
  if (arduino_connected == WL_CONNECTED) {
    // arduino connesso con successo alla rete fornita
    robotBegin();
  } else {
    // connessione alla rete WiFi fallita
    Serial.println("[log] Non è stato possibile connettersi alla rete fornita.");

    // instaurazione rete "fail-safe"
    startAccessPoint();
  }
  /*
     ################################ FINE: WiFi ################################
  */

  /*
     utile ai fini della generazione di numeri random senza pattern di ripetizione iniziale:
     if analog input pin 0 is unconnected, random analog
     noise will cause the call to randomSeed() to generate
     different seed numbers each time the sketch runs.
     randomSeed() will then shuffle the random function.
  */
  randomSeed(analogRead(5));
}

/*
   robotBegin, inizializzazione classi e componenti primari dell'unità robot
*/
void robotBegin() {
  // erogazione web server su porta :80
  server.begin();

  // stampa su seriale di informazioni diagnostiche della rete
  printWifiStatus();

  // configurazione sensori frontali e laterali tramite codice modello
  sensor_fl.setModel(SharpDistSensor::GP2Y0A41SK0F_5V_DS);
  sensor_fr.setModel(SharpDistSensor::GP2Y0A41SK0F_5V_DS);
  sensor_sr.setModel(SharpDistSensor::GP2Y0A51SK0F_5V_DS);
  sensor_sl.setModel(SharpDistSensor::GP2Y0A51SK0F_5V_DS);

  /*
     Inizializzazione classe Battery tramite metodo begin()
     5000       : tensione riferimento scheda (Arduino Uno = 5V)
     2.48       : voltage ratio - > (R1+R2)/R2 -> [46kΩ+(19.6kΩ+9.82kΩ)/(19.6kΩ+9.82kΩ)] = 46+29.42/29.42 = 2.56
     &sigmoidal : metodo di mappatura efficiente [fare riferimento a Battery.h]
  */
  battery.begin(5000, 2.56, &sigmoidal);

  /*
     verifica livello carica batteria ed impostazione flag analogo
     inizializzazione ventola, causerà piccolo drop della tensione dovuto al picco iniziale (crank)
  */
  if (battery.voltage() > batt_empty) {
    is_battery_charged = true;

    //digitalWrite(fan_mosfet, HIGH);
    digitalWrite(green_led, HIGH);

    // delay
    delay(2000);
  }
}

/*
   startAccessPoint, attivazione modulo WiFi NINA-W102 in modalità access point
*/
void startAccessPoint() {
  Serial.println("[log] Inizializzazione procedura di instaurazione rete \"fail-safe\".");
  // 1. scan reti nelle vicinanze
  Serial.println("[log] Avvio scansione reti Wi-Fi disponibili...");
  scanNetworks();

  // 2. instaurazione modalità access point
  Serial.print("[log] Attivazione Access Point(AP) interno ");
  Serial.print(cfg_ap_ssid);
  Serial.println("...");
  status_ap = WiFi.beginAP(cfg_ap_ssid, cfg_ap_pass);
  if (status_ap != WL_AP_LISTENING) {
    Serial.println("[errore] Instaurazione Access Point(AP) interno fallito.");
    Serial.println("[errore] Il programma verrà arrestato.");
    while (true);
  }
  // todo: di default si dovrebbe attendere 10s
  delay(5000);

  // 3. erogazione web server con socket -> 192.168.4.1:8080
  server_ap.begin();
  IPAddress ip_ap = WiFi.localIP();
  // stampa SSID d indirizzo IP rete instaurata
  Serial.println("[log] Access Point(AP) interno attivato con successo!");
  Serial.print("[log] SSID: ");
  Serial.print(WiFi.SSID());
  Serial.print(" | IP: ");
  Serial.println(ip_ap);

  // 4. flag per loop()
  wifi_ap_mode = true;
}


/*
   connectToNetwork, connette arduino a rete WiFi secondo i parametri forniti
   @ssid, nome rete a cui connettersi
   @pass, password rete a cui connettersi
   @max_attemps, numero massimo di tentativi di connessione consentiti prima di abortire l'operazione
*/
int connectToNetwork(char ssid[], char pass[], short max_attemps) {
  String wifi_fv;
  short wait = 5000;
  short attemps = 0;

  // check modulo hardware
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("[errore] Comunicazione con il modulo WiFi fallita.");
    Serial.println("[errore] Il programma verrà arrestato.");
    while (true);
  }
  // check versione firmware
  wifi_fv = WiFi.firmwareVersion();
  if (wifi_fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("[upgrade] Disponibile un aggiornamento del firmware WiFi!");
  }

  // si imposta l'Hostname per utilizzarlo come riferimento nelle richieste HTTP
  WiFi.setHostname("arduino-wifi-robot-0df8");

  // connessione alla rete wireless
  while ((status != WL_CONNECTED) && attemps < max_attemps) {
    Serial.print("[log] Tentativo di connessione alla rete: ");
    Serial.println(ssid);

    status = WiFi.begin(ssid, pass);

    // todo: di default si dovrebbe attendere 10s
    delay(wait);

    // aggiornamenti per nuovo tentativo
    wait += 1000;
    attemps++;
  }

  return status;
}


/*
   @process_cfg, lettura ed analisi dei comandi ocntenuti nel file .cfg in microSD
*/
void process_cfg() {
  if (strcmp(sdcc.getCmd(), "ssid") == 0) {
    strcpy(cfg_ssid, sdcc.getValue());
  } else if (strcmp(sdcc.getCmd(), "pass") == 0) {
    strcpy(cfg_pass, sdcc.getValue());
  } else if (strcmp(sdcc.getCmd(), "ssid_ap") == 0) {
    strcpy(cfg_ap_ssid, sdcc.getValue());
  } else if (strcmp(sdcc.getCmd(), "pass_ap") == 0) {
    strcpy(cfg_ap_pass, sdcc.getValue());
  } else {
    // todo:
    //Serial.print("[microsd] ");
    //Serial.print(sdcc.getCmd());
    //Serial.println(" non è un'operazione riconosciuta.");
  }
}

/*
   @microsd_debug, ripristino del file di configurazione .cfg in microSD
   todo: da rimuovere in futuro
*/
bool microsd_debug() {
  // Access SD card
  if ( !SD.begin(CHIPSELECT) ) {
    return 0;
  }

  // Remove the original config file
  SD.remove(SETTING_FILE);
  // Re-create a blank config file
  File restore;

  if ( !(restore = SD.open(SETTING_FILE, FILE_WRITE)) ) {
    return 0;
  }
  // Write everything back into the file
  restore.println("// Impostazioni di Rete");
  restore.println("ssid=FRITZ!Box753");
  restore.println("pass=Conti098890?");
  restore.println("ssid_ap=wifiRobot0df8");
  restore.println("pass_ap=Ab02er98?E");
  restore.println();

  // Close the file
  restore.close();

  Serial.print("[microsd] ");
  Serial.print(SETTING_FILE);
  Serial.println(" ripristinato.");

  return 1;
}

/*
   scanNetworks, rilevazione di reti Wifi nelle vicinanze
*/
void scanNetworks() {
  // numero di reti individuate
  numSsid = WiFi.scanNetworks();
  if (numSsid == -1) {
    Serial.println("[errore] Impossibile stabilire una connessione di rete.");
    Serial.println("[errore] Il programma verrà arrestato.");
    while (true);
  }
  Serial.print("[wifi] Numero di reti individuate nelle vicinanze: ");
  Serial.println(numSsid);

  // stampa dell'SSID di ogni rete individuata assieme al protocollo di sicurezza
  for (int thisNet = 0; thisNet < numSsid; thisNet++) {
    Serial.print("\t");
    Serial.print(thisNet);
    Serial.print(") ");
    Serial.print(WiFi.SSID(thisNet));
    Serial.print(" [RSSI: ");
    Serial.print(WiFi.RSSI(thisNet));
    Serial.print("dBm");
    Serial.print(" | Sicurezza: ");
    printEncryptionType(WiFi.encryptionType(thisNet));
    Serial.println("]");

    // si conservano massimo 16 reti in memoria per uso futuro
    if (numSsid < 16) {
      networks[thisNet] = WiFi.SSID(thisNet);
    }
  }
}

/*
   printEncryptionType, stampa dell'algoritmo di cifratura per il tipo di rete fornito
   @thisType, indice rete WiFi scansionata con WiFi.scanNetworks()
*/
void printEncryptionType(int thisType) {
  switch (thisType) {
    case ENC_TYPE_WEP:
      Serial.print("WEP");
      break;
    case ENC_TYPE_TKIP:
      Serial.print("WPA");
      break;
    case ENC_TYPE_CCMP:
      Serial.print("WPA2");
      break;
    case ENC_TYPE_NONE:
      Serial.print("Nessuna");
      break;
    case ENC_TYPE_AUTO:
      Serial.print("Auto");
      break;
    default:
      Serial.print("-");
      break;
  }
}

/*
   percentDecode, decode parametro estratto tramite regexp da richiesta HTTP (es. FRITZ%21BOX -> FRITZ!Box)
   @src, stringa parametro
   nota: modifica variabile sul posto, quindi non è necessaria variabile di ritorno.
*/
void percentDecode(char *src) {
  char *dst = src;

  while (*src) {
    if (*src == '+') {
      src++;
      *dst++ = ' ';
    }
    else if (*src == '%') {
      // handle percent escape

      *dst = '\0';
      src++;

      if (*src >= '0' && *src <= '9') {
        *dst = *src++ - '0';
      }
      else if (*src >= 'A' && *src <= 'F') {
        *dst = 10 + *src++ - 'A';
      }
      else if (*src >= 'a' && *src <= 'f') {
        *dst = 10 + *src++ - 'a';
      }

      // this will cause %4 to be decoded to ascii @, but %4 is invalid
      // and we can't be expected to decode it properly anyway

      *dst <<= 4;

      if (*src >= '0' && *src <= '9') {
        *dst |= *src++ - '0';
      }
      else if (*src >= 'A' && *src <= 'F') {
        *dst |= 10 + *src++ - 'A';
      }
      else if (*src >= 'a' && *src <= 'f') {
        *dst |= 10 + *src++ - 'a';
      }

      dst++;
    }
    else {
      *dst++ = *src++;
    }

  }
  *dst = '\0';
}


/*
   millisToString, decodifica millisecondi in data
   @t, tempo misurato in secondi -> millis() / 1000;
*/
/*
  char * millisToString(unsigned long t)
  {
  static char str[12];
  long h = t / 3600;
  t = t % 3600;
  int m = t / 60;
  int s = t % 60;
  sprintf(str, "%04ld:%02d:%02d", h, m, s);
  return str;
  }
*/

/*
   checkBattery, funzione invocata periodicamente tramite timer per controllare livello carica batteria
*/
bool checkBattery() {
  bool safe = true;

  Serial.print("[batteria] Monitoraggio livello di carica: ");
  Serial.print(battery.voltage());
  Serial.print("mV (");
  Serial.print(battery.level());
  Serial.println("%)");

  // nel caso in cui la tensione scenda sotto al limite imposto, si alzano flag sospendere l'esecuzione del programma
  if (battery.voltage() <= batt_empty) {
    is_battery_charged = false;
    safe = false;
  }

  return safe;
}

/*
   forwardMotors, muovere unità robot con direzione frontale per un periodo di tempo determinato o indeterminato
   @moveTime, periodo di tempo in millisecondi in cui mantenere tale direzione
*/
void forwardMotors(int moveTime) {
  // todo: SoftPWMSetPercent(m1_en, 60);

  /*
     sufficiente controllare 2 pin per ogni motore:
     1. phase:   direzione di rotazione del motore
     2. enable:  segnale pwm per imprimere velocità di rotazione nonchè di spostamento
  */
  digitalWrite(m1_ph, HIGH);
  analogWrite(m1_en, m_speed);
  digitalWrite(m2_ph, HIGH);
  analogWrite(m2_en, m_speed);

  // se il periodo fornito è positivo mantenere tale direzione per i millisecondi forniti
  if (moveTime > 0) {
    delay(moveTime);
    stopMotors();
  }
}
/*
   backwardMotors, muovere unità robot in retromarcia per un periodo di tempo determinato o indeterminato
   @moveTime, periodo di tempo in millisecondi in cui mantenere tale direzione
*/
void backwardMotors(int moveTime) {
  digitalWrite(m1_ph, LOW);
  analogWrite(m1_en, m_speed);
  digitalWrite(m2_ph, LOW);
  analogWrite(m2_en, m_speed);

  if (moveTime > 0) {
    delay(moveTime);
    stopMotors();
  }
}
/*
   rightMotors, ruotare unità robot verso destra per un periodo di tempo determinato o indeterminato
   @moveTime, periodo di tempo in millisecondi in cui mantenere tale direzione
*/
void rightMotors(int moveTime) {
  digitalWrite(m1_ph, LOW);
  analogWrite(m1_en, m_speed);
  digitalWrite(m2_ph, HIGH);
  analogWrite(m2_en, m_speed);

  if (moveTime > 0) {
    delay(moveTime);
    stopMotors();
  }
}
/*
   leftMotors, ruotare unità robot verso sinistra per un periodo di tempo determinato o indeterminato
   @moveTime, periodo di tempo in millisecondi in cui mantenere tale direzione
*/
void leftMotors(int moveTime) {
  digitalWrite(m1_ph, HIGH);
  analogWrite(m1_en, m_speed);
  digitalWrite(m2_ph, LOW);
  analogWrite(m2_en, m_speed);

  if (moveTime > 0) {
    delay(moveTime);
    stopMotors();
  }
}
/*
   stopMotors, stop dei motori
*/
void stopMotors() {
  //digitalWrite(m1_ph, LOW); // indifferente
  analogWrite(m1_en, 0);
  //digitalWrite(m2_ph, LOW); // indifferente
  analogWrite(m2_en, 0);
}


/*
   setMotorsSpeed, utile ad impostare velocità motori
   @pwm, velocità [intero positivo][50-250]
*/
void setMotorsSpeed(int pwm) {
  // limitazione range
  m_speed = constrain(pwm, 50, 250);
}

/*
   moveMotorsDiffSpeeds, muove unità robot con velocità motori di sinistra e destra fornite come parametri
*/
void moveMotorsDiffSpeeds(short v1, short v2, byte direction, short moveTime) {
  // limitazione parametri velocità all'interno del range PWM dell'andamento a spirale
  v1 = constrain(v1, 50, 200);
  v2 = constrain(v2, 50, 200);

  digitalWrite(m1_ph, direction);
  analogWrite(m1_en, v1);
  digitalWrite(m2_ph, direction);
  analogWrite(m2_en, v2);

  if (moveTime > 0) {
    delay(moveTime);
    // stopMotors();
  }
}

/*
   setBehaviour, utile ad impostare modalità di operatività robot durante fase loop()
   @mode, modalità operativa da impostare [intero]
*/
void setBehaviour(int mode) {
  // limitazione range parametro
  behaviour_selector = constrain(mode, -1, 5);
  // si preferisce fermare i motori ad ogni cambio di operativita
  stopMotors();
}

/*
   bumperHandling, definisce comportamento a seguito dell'attivazione dello switch a levetta frontale (bumper)
   @mode, modalità operativa in uso
*/
void bumperHandling(int mode) {
  if (digitalRead(bumper) == LOW) {
    // attivazione flag bumper in base a lettura pin switch
    bumper_status = HIGH;

    // retromarcia
    backwardMotors(500);

    // todo:
    if (distance_fl < distance_fr) {
      rightMotors(500);
    } else {
      leftMotors(500);
    }

    // todo
    if (mode == 1) {
      stopMotors();
    }

    Serial.print("[log] Collisione bumper frontale rilevata.");

    // reset bumper_status
    bumper_status = LOW;
  }
}

/*
   randomWalk, algoritmo area coverage
   nota: navigazione in modalità randomica evitando ostacoli presenti nell'area circostante
*/
void randomWalk() {
  // limiti rilevazioni sensori [frontali, laterali]
  int rw_bounds[2] = {90, 40};

  // gestione angoli e sensori frontali
  if (randomWalk_count == 3) {
    backwardMotors(200);

    // todo: calcolare 360° a 180pwm
    if (random(0, 1)) {
      rightMotors(1400);
    } else {
      leftMotors(1400);
    }

    // reset couner
    randomWalk_count = 0;

  } else if (distance_fl <= rw_bounds[0] &&
             distance_fl < distance_fr) {
    // ostacolo a sinistra
    // todo: calcolare angoli in relazione al delay del motore (rapportati al sig. PWM)
    rightMotors(random(100, 400));

    randomWalk_count = randomWalk_count + 1;
    // reset counter se verso rotazione uguale alla precedente
    if (randomWalk_count == 1) {
      randomWalk_count == 0;
    }

  } else if (distance_fr <= rw_bounds[0] &&
             distance_fr < distance_fl) {
    // ostacolo a destra
    leftMotors(random(100, 400));

    randomWalk_count = randomWalk_count + 2;
    // reset counter se verso rotazione uguale alla precedente
    if (randomWalk_count == 2) {
      randomWalk_count == 0;
    }

  } else {
    // di default si prosegue in direzione frontale
    forwardMotors(0);

  }

  // gestione sensori laterali
  if (distance_sl <= rw_bounds[1]) {
    backwardMotors(100);
    rightMotors(100);
  } else if (distance_sr <= rw_bounds[1]) {
    backwardMotors(100);
    leftMotors(100);
  }

  // monitoraggio bumper...
  bumperHandling(0);
}

/*
   boustrophedon, algoritmo area coverage
   nota: https://robotics.stackexchange.com/a/632
*/
void boustrophedon() {
  int b_bounds[2] = {150, 30};

  // rilevazione superficie frontale estesa
  if (distance_fl <= b_bounds[0] &&
      distance_fr <= b_bounds[0]) {

    if (m_speed != 60) {
      setMotorsSpeed(60);
    }

    // verifica se l'unità robot sia parallela alla superficie
    boustrophedon_diff = distance_fl - distance_fr;
    if (boustrophedon_diff == 0) {
      // alzo flag
      boustrophedon_parallel = true;
      stopMotors();
    } else if (distance_fr > distance_fl) {
      leftMotors(5);
    } else {
      rightMotors(5);
    }

    if (boustrophedon_parallel) {
      // piccola attesa di assestamento
      stopMotors();
      delay(100);

      // incremento della velocità
      setMotorsSpeed(100);

      // rotazione a sensi alternati ad ogni riga compiuta
      if ( (boustrophedon_counter & 0x01) == 0) {
        // rotazione di 90° in senso orario
        // todo: calcolare tempo necessario per far girare robot di 90° al dato PWM
        rightMotors(1350);
        stopMotors();
        delay(50);

        // avanti 1 roboUnit
        // todo: calcolare roboUnit in ms
        forwardMotors(2100);
        stopMotors();
        delay(50);

        // rotazione di 90° in senso orario
        rightMotors(1350);
        stopMotors();
        delay(50);
      } else {
        // rotazione di 90° in senso antiorario
        // todo: calcolare tempo necessario per far girare robot di 90° al dato PWM
        leftMotors(1350);
        stopMotors();
        delay(50);

        // avanti 1 roboUnit
        // todo: calcolare roboUnit in ms
        forwardMotors(2100);
        stopMotors();
        delay(50);

        // rotazione di 90° in senso antiorario
        leftMotors(1350);
        stopMotors();
        delay(50);
      }

      // reset velocità a valore di default
      setMotorsSpeed(default_speed);

      // reset flag ed incremento contatore per invertire rotazioni durante la prossima superficie
      boustrophedon_parallel = false;
      boustrophedon_counter++;
    }

  } else {
    // verifica velocità
    if (m_speed != default_speed) {
      setMotorsSpeed(default_speed);
    }

    // default: avanti
    forwardMotors(0);
  }

  // controllo sensori laterali
  if (distance_sl <= b_bounds[1]) {
    rightMotors(50);
  } else if (distance_sr <= b_bounds[1]) {
    leftMotors(50);
  }

  // monitoraggio bumper...
  bumperHandling(0);
}

/*
   spiral, algoritmo area coverage
*/
short tourtime = 1000; // circle tourtime. it is about intersection areas between each spiral. it should be less than circle time
short increasetime = 10; // time for next tour, larger spiral needs more time
short min_s_speed = 50; // initial speed for spiral.
short max_s_speed = 200;// max speed
bool spiralling = true;
void spiral() {
  if ( distance_fr <= bubbleBandBounds[0] ||
       distance_fl <= bubbleBandBounds[0]) {
    stopMotors();

    backwardMotors(400);
    (distance_sr <= distance_sl) ? leftMotors(500) : rightMotors(500);

    forwardMotors(1000);

    // reset condizione se necessario
    if (spiralling == false) {
      spiralling = true;
      // reset parametri
      min_s_speed = 50;
      tourtime = 1000;
    }

    // Serial.println("[spiral] ostacoli frontali.");
  } else if (distance_sr <= 80) {
    if (spiralling == true) {
      spiralling = false;
    }

    (distance_sr <= bubbleBandBounds[1]) ? leftMotors(5) : forwardMotors(0);

    // Serial.println("[spiral] ostacoli destra.");
  } else if (distance_sl <= 80) {
    if (spiralling == true) {
      spiralling = false;
    }

    (distance_sr <= bubbleBandBounds[1]) ? rightMotors(5) : forwardMotors(0);

    // Serial.println("[spiral] ostacoli sinistra.");
  } else if (spiralling == true) {
    // movimento a spirale di default
    moveMotorsDiffSpeeds(max_s_speed, min_s_speed, HIGH, tourtime);
    // delay(tourtime); // TODO: debug

    if (min_s_speed < max_s_speed) {
      // incremento velocità
      min_s_speed = min_s_speed + 3;
      // incremento tourtime
      tourtime = tourtime + increasetime; // increase the time for scan optimum area
    }

    Serial.print("[spiral] tourtime: ");
    Serial.print(tourtime);
    Serial.print(" | min_s_speed: ");
    Serial.println(min_s_speed);

  } else if (spiralling == false) {
    if (distance_fr >= bubbleBandBounds[0] &&
        distance_fl >= bubbleBandBounds[0] &&
        distance_sr >= bubbleBandBounds[1] &&
        distance_sl >= bubbleBandBounds[1]) {
      spiralling = true;
      // reset parametri
      min_s_speed = 50;
      tourtime = 1000;
    }
  }
}

/*
   selfProtection,  funzione attiva in background quando il robot è sotto il controllo remoto o Blockly
                    dedicata alla protezione del robot evitando collisioni con ostacoli di diversa natura
   @mode, modalità operativa: 0 = controllo remoto | 1 = blockly
   @logs, modalità logging:   0 = no logs | 1 = logging
   ranges ->  front ->  4-9cm (F1) | 10-15cm (F2) | 16-30cm (F3)
              side  ->  2-5cm (S1) | 6-12cm (S2) | 13-15cm (S3)
   levels ->  {front-left, front-right, side-left, side-right}
*/
void selfProtection(int mode, byte logs) {
  /*
     si verifica che sia attiva la funzionaltità
     a volta si preferisce mantenerla disabilitata per evitare movimenti del robot in momenti non opportuni
  */
  if (self_protection_enabled) {
    // si assegnano i livelli di distanza allo stato attuale delle rilevazioni dei sensori
    if (distance_fl <= front_ranges[0])  {
      levels[0] = 1;
    } else if (distance_fl <= front_ranges[1])  {
      levels[0] = 2;
    } else {
      levels[0] = 3;
    }
    if (distance_fr <= front_ranges[0])  {
      levels[1] = 1;
    } else if (distance_fr <= front_ranges[1])  {
      levels[1] = 2;
    } else {
      levels[1] = 3;
    }
    if (distance_sl <= side_ranges[0])   {
      levels[2] = 1;
    } else if (distance_sl <= side_ranges[1])   {
      levels[2] = 2;
    } else {
      levels[2] = 3;
    }
    if (distance_sr <= side_ranges[0])   {
      levels[3] = 1;
    } else if (distance_sr <= side_ranges[1])   {
      levels[3] = 2;
    } else {
      levels[3] = 3;
    }

    // verifica dei livelli rilevati
    lv_medium = false;
    lv_low = false;
    for (int x = 0; x < 4; x++) {
      if (levels[x] <= 2) {
        lv_medium = true;
      }
      if (levels[x] == 1) {
        lv_low = true;
      }
    }

    /*
       se almeno uno dei 4 elementi dell'array levels[] è impostato a 2:
       - modulazione della velocità dell'unità robot
    */
    if (lv_medium == true && (m_speed == default_speed )) {
      // riduzione velocità del <x>%
      setMotorsSpeed((default_speed * 80) / 100);
    } else if (lv_medium == false && (m_speed != default_speed)) {
      // ripristino della velocità
      setMotorsSpeed(default_speed);
    }

    /*
       se almeno uno dei 4 elementi dell'array levels[] è impostato a 1:
       - rimodulazione del path corrente
    */
    if (lv_low == true) {
      // #### --> INIZIO gestione ostacoli <-- ####
      // ### --> gestione ostacoli frontali <-- ###
      if (levels[0] == levels[1] == 1) {
        // ostacolo frontale esteso
        // Serial.println("[debug] selfProtection: ostacolo frontale esteso.");
        stopMotors();

        // ricerca lato migliore dove ruotare
        if (distance_fl >= distance_fr) {
          while (sensor_fl.getDist() <= front_ranges[1]) {
            leftMotors(50);
          }
        } else {
          while (sensor_fr.getDist() <= front_ranges[1]) {
            rightMotors(50);
          }
        }

        stopMotors();

      } else if (levels[0] == 1) {
        // ostacolo frontale sinistro
        // elaborazione parametri per ri-modulazione path
        int Ki = map(distance_fl, 40, front_ranges[1], 50, 5);
        int Tf = Ki + round5delta[Ki % 5];
        rightMotors(Tf);

      } else if (levels[1] == 1) {
        // ostacolo frontale destro
        int Ki = map(distance_fr, 40, front_ranges[1], 50, 5);
        int Tf = Ki + round5delta[Ki % 5];
        leftMotors(Tf);

      }


      // ### --> gestione ostacoli laterali <-- ###
      if (levels[2] == 1) {
        // ostacolo laterale sinistro
        if (last_remote_direction != 1) {
          rightMotors(20);
        }

      } else if (levels[3] == 1) {
        // ostacolo laterale destro
        if (last_remote_direction != 2) {
          leftMotors(20);
        }

      }
      // ##### --> FINE gestione ostacoli <-- #####

      // segnalazione flag attivazione algoritmo
      if (wasBBXon == 0) {
        wasBBXon = 1;
      }

    }

    /*
       se algoritmo in esecuzione durante il controllo remoto si riprende la direzione richiesta
       prima della rilevazione dell'ostacolo ed eventuale ri-modulazione del percorso
    */
    if (mode == 0) {
      switch (last_remote_direction) {
        case 0:
          forwardMotors(0);
          break;
        case 1:
          leftMotors(0);
          break;
        case 2:
          rightMotors(0);
          break;
        case 3:
          backwardMotors(0);
          break;
        case 4:
          stopMotors();
          break;
      }
    }

    // debug controllo livello temporizzato
    if (logs) {
      currentMillis_algo = millis();
      if (currentMillis_algo - prevMillis_algo > interval_algo) {
        prevMillis_algo = currentMillis_algo;

        // logging
        Serial.print("[debug] Levels -> front-left: ");
        Serial.print(levels[0]);
        Serial.print(" | front-right: ");
        Serial.print(levels[1]);
        Serial.print(" | side-left: ");
        Serial.print(levels[2]);
        Serial.print(" | side-right: ");
        Serial.println(levels[3]);
        Serial.print("[debug] Speed -> ");
        Serial.println(m_speed);
      }
    }
  }
}

/*
   printWifiStatus, stampa in seriale infromazioni relative alla connettività WiFi
*/
void printWifiStatus() {
  // stampa SSID rete
  Serial.print("[log] SSID: ");
  Serial.print(WiFi.SSID());

  // stampa indirizzo IP arduino
  IPAddress ip = WiFi.localIP();
  Serial.print(" | Indirizzo IP: ");
  Serial.print(ip);

  // stampa qualità del segnale
  long rssi = WiFi.RSSI();
  Serial.print(" | Qualità segnale (RSSI): ");
  Serial.print(rssi);
  Serial.println(" dBm");
}


/*
   loop
*/
void loop() {

  // verifica modalità connessione wireless
  if (wifi_ap_mode) {
    /*
      ############################## INIZIO: WiFi Access Point(AP) ##############################
    */
    bool startNewConnection = false;
    char *ssid_ap_requested_char;
    char *pass_ap_requested_char;

    // verifica stato wifi corrente con precedente per rilevare cambiamenti
    if (status != WiFi.status()) {
      status = WiFi.status();

      if (status == WL_AP_CONNECTED) {
        Serial.println("[wifi] Dispositivo connesso ad AP Arduino.");
      } else if (status == WL_DISCONNECTED) {
        Serial.println("[wifi] Dispositivo disconnesso da AP Arduino.");
      }
    }

    // variabile in ascolto di nuove connessioni da client
    WiFiClient client_ap = server_ap.available();
    if (client_ap) {
      String ssid_ap_requested = "";
      String pass_ap_requested = "";
      bool wifi_connect_req = false;
      String currentLine = "";

      // client connesso(inizio richiesta HTTP) -->
      while (client_ap.connected()) {
        if (client_ap.available()) {
          // lettura byte a byte
          char c = client_ap.read();
          // Serial.write(c); //DEBUG
          if (c == '\n') {
            /*
               se la linea letta (currentLine) è vuota, allora si è letto due caratteri '\n' di seguito
               ergo si è giunti alla fine della richiesta HTTP del client, si invia la risposta:
            */
            if (currentLine.length() == 0) {
              // header HTTP inizia con un 'respose code' (es. HTTP/1.1 200 OK)
              // segue il content-type ed una linea vuota
              client_ap.println("HTTP/1.1 200 OK");
              client_ap.println("Content-Type: text/html; charset=UTF-8");
              client_ap.println("Accept-Charset: utf-8");
              client_ap.println();

              // contenuto della richiesta HTTP
              client_ap.print("<!DOCTYPE html><html lang=\"it\"><head><title>Connetti Robot a rete Wireless</title><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
              client_ap.print("<style type=\"text/css\">");
              client_ap.print("body{font-family:Helvetica Neue;padding:10px}h1{margin-bottom:40px}form > *{display:block;font-size:20px}form > select,input{margin:15px 0;margin-top:0;box-sizing:border-box;width:100%}");
              client_ap.print("form > input[type=\"submit\"]{border-radius:5px;background-color:#add8e6;border:2px solid #fff;padding:12px 10px}");
              client_ap.print("</style></head>");
              client_ap.print("<body><h1 id=\"title\">Connetti Robot a rete Wireless</h1>");
              client_ap.print("<form action=\"/wificonnect\" id=\"networkform\" accept-charset=\"utf-8\"><label for=\"network\">Rete:</label><select id=\"networks\" name=\"network\" form=\"networkform\">");
              // popolazione tag HTML select con lista reti disponibili ricavate da scansione precedente
              for (int netcount = 0; netcount < numSsid; netcount++) {
                client_ap.println(networks[netcount]);
                client_ap.print("<option value=\"");
                client_ap.print(networks[netcount]);
                client_ap.print("\">");
                client_ap.print(networks[netcount]);
                client_ap.print("</option>");
              }
              client_ap.print("</select><br /><label for=\"password\">Password:</label><input type=\"password\" id=\"password\" name=\"password\" required><br/><br/><input type=\"submit\"></form></body></html>");

              // richiesta HTTP termina con una linea vuota
              client_ap.println();

              // break del ciclo while
              break;
            } else {
              // linea nuova
              char buf [100] = "";
              currentLine.toCharArray(buf, 100);

              // istanza matchState
              regexp.Target(buf);

              // GET /wificonnect?network=FRITZ%21Box7530&password=prova+password HTTP/1.1
              if (regexp.Match("GET( )%/wificonnect%?network=(.+)&password=(.+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                // alzo flag richiesta di connessione a nuova rete WiFi
                wifi_connect_req = true;
                // recupero e salvo ssid e password rete
                ssid_ap_requested = regexp.GetCapture(buf, 1);
                pass_ap_requested = regexp.GetCapture(buf, 2);
              }

              // pulizia linea corrente per iniziare nuova lettura
              currentLine = "";
            }
          } else if (c != '\r') {
            // qualsiasi byte letto eccetto il carriage return viene aggiunto come contributo alla linea corrente(currentLine)
            currentLine += c;
          }
        }
      }
      // <-- client disconnesso(termine richiesta HTTP)

      // gestione richiesta connessione a nuova rete -> URL: /wificonnect?network=<ssid>&password=<password>
      if (wifi_connect_req == true) {
        // css
        client_ap.print("<style type=\"text/css\">#networkform, #title {display:none;}</style>");
        // conversione String a char*
        ssid_ap_requested_char = const_cast<char*>(ssid_ap_requested.c_str());
        pass_ap_requested_char = const_cast<char*>(pass_ap_requested.c_str());
        // decodifica parametri sul posto ( %21 => ! )
        percentDecode(ssid_ap_requested_char);
        percentDecode(pass_ap_requested_char);

        // contenuto da aggiungere a risposta HTTP
        client_ap.print("<h1>Connessione alla rete ");
        client_ap.print(ssid_ap_requested_char);
        client_ap.println(" ... </h1>");
        client_ap.println("<p>Al termine della configurazione collegarsi all'unità Robot attraverso l'App dedicata.</p>");

        // termine comunicazione con client, segue delay per instaurare nuova connessione
        client_ap.stop();
        delay(1000);

        // salvataggio parametri nuova rete nella microSD per storage permanente
        if (sdcc.writeConfig("ssid", ssid_ap_requested_char) && sdcc.writeConfig("pass", pass_ap_requested_char)) {
          Serial.println("[log] Impostazioni di rete aggiornate con successo!");
        } else {
          Serial.println("[error] Non è stato possibile salvare le nuove impostazioni di rete.");
        }
        // aggiornamento comandi da file di configurazione
        //sdcc.readConfig();

        int arduino_connected = connectToNetwork(ssid_ap_requested_char, pass_ap_requested_char, 5);
        if (arduino_connected == WL_CONNECTED) {
          // arduino connesso con successo alla rete fornita
          robotBegin();

          // falg per uscire da questo ramo dell'if in loop()
          wifi_ap_mode = false;
        } else {
          // connessione alla rete WiFi fallita
          Serial.println("[log] Non è stato possibile connettersi alla rete fornita.");

          // instaurazione rete "fail-safe"
          startAccessPoint();
        }
      }

      // termine comunicazione con client,
      client_ap.stop();
    }
    /*
      ############################## FINE: WiFi Access Point(AP) ##############################
    */

  } else {

    /*
      ############################## INIZIO: Arduino Web Server ##############################
    */
    if (status != WiFi.status()) {
      Serial.print("[wifi] Wi-Fi status variato: ");
      Serial.println(status);

      status = WiFi.status();
    }

    // variabile in ascolto di nuove connessioni da client
    WiFiClient client = server.available();
    if (client) {
      // lettura linea richiesta HTTP
      String currentLine = "";
      // variabili d'appoggio per gestione richieste HTTP
      String sensorRequested = "";
      bool cmd_not_found = true;
      short multiplexer = -1;
      short mdelay = -1;
      short mspeed = -1;
      short authcode = -1;
      short opmode = -1;
      short fanStatus = -1;
      short blocklyStatus = -1;
      char result;
      char *timestamp_log;

      // client connesso(inizio richiesta HTTP) -->
      while (client.connected() && cmd_not_found) {
        if (client.available()) {
          // lettura byte richiesta HTTP
          char c = client.read();
          // Serial.write(c); //DEBUG

          if (c == '\n') {
            /*
               se la linea letta (currentLine) è vuota, allora si è letto due caratteri '\n' di seguito
               ergo si è giunti alla fine della richiesta HTTP del client, si invia la risposta:
            */
            if (currentLine.length() == 0) {
              // vuoto perchè richieste verranno gestite distintamente terminata la lettura
              break;
            } else {
              // buffer per ospitare richieste HTTP
              char buf [100] = "";
              currentLine.toCharArray(buf, 100);

              regexp.Target(buf);

              // multiplexing delle richieste
              if (regexp.Match("POST( )%/api%/motors%/forward%?delay=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_FORWARD_DELAY;
                mdelay = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/motors%/left%?delay=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_LEFT_DELAY;
                mdelay = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/motors%/right%?delay=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_RIGHT_DELAY;
                mdelay = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/motors%/backward%?delay=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_BACKWARD_DELAY;
                mdelay = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/motors%/stop%?auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_STOP;
                authcode = atoi(regexp.GetCapture(buf, 1));

              } else if (regexp.Match("POST( )%/api%/motors%/speed%?value=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = MOTORS_SET_SPEED;
                mspeed = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("GET( )%/api%/connect( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_CONNECT_REQ;

              } else if (regexp.Match("GET( )%/api%/disconnect%?auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_DISCONNECT_REQ;
                authcode = atoi(regexp.GetCapture(buf, 1));

              } else if (regexp.Match("POST( )%/api%/setmode%?op=(.+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_SET_MODE;
                opmode = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("GET( )%/api%/sensors%/battery%?auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_GET_BATTERY;
                authcode = atoi(regexp.GetCapture(buf, 1));

              } else if (regexp.Match("GET( )%/api%/sensors%/(.+)%?auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_GET_SENSORS;
                sensorRequested = regexp.GetCapture(buf, 1);
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/ping%?auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_GET_PING;
                authcode = atoi(regexp.GetCapture(buf, 1));

              } else if (regexp.Match("POST( )%/api%/fan%?status=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_SET_FAN;
                fanStatus = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              } else if (regexp.Match("POST( )%/api%/blockly%?status=(%d+)&auth=(%d+)( )HTTP%/1%.1") == REGEXP_MATCHED) {
                multiplexer = ROBOT_SET_BLOCKLY;
                blocklyStatus = atoi(regexp.GetCapture(buf, 1));
                authcode = atoi(regexp.GetCapture(buf, 2));

              }

              // pulizia linea corrente
              currentLine = "";
            }
          } else if (c != '\r') {
            // qualsiasi byte letto eccetto il carriage return viene aggiunto come contributo alla linea corrente(currentLine)
            currentLine += c;
          }
        }
      }
      // <-- client disconnesso(termine richiesta HTTP)

      // se primo comando da remoto ricevuto abilito algoritmi di self-protection
      if ((multiplexer == MOTORS_FORWARD_DELAY ||
           multiplexer == MOTORS_LEFT_DELAY ||
           multiplexer == MOTORS_RIGHT_DELAY ||
           multiplexer == MOTORS_BACKWARD_DELAY) &&
          !self_protection_enabled)
      {
        self_protection_enabled = !self_protection_enabled;
        Serial.println("[log] Abilitazione algoritmo Bubble Band per evitare collisioni con ostacoli.");
      }

      // richiesta connessione client ad unità robot
      if (multiplexer == ROBOT_CONNECT_REQ) {
        // verifica che sia la prima (ed unica) richiesta di connessione
        if (connection_req_auth == -1) {
          // generazione codice numerico(4) per autorizzazione richieste future
          connection_req_auth = random(1000, 9999);

          // imposto modalità controllo remoto
          setBehaviour(0);

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"CONNECTED\",\"message\":\"Connesso all'unità Robot con successo!\",\"auth\":");
          client.print(connection_req_auth);
          client.print("}");
          client.println();

          // Logging
          Serial.print("[wifi] Client connesso con successo con authcode: ");
          Serial.println(connection_req_auth);
        } else {
          // HTTP response
          client.println("HTTP/1.1 400 Bad Request");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"ERROR\",\"message\":\"Unità Robot già connessa con un altro dispositivo.\"}");
          client.println();
        }
      }

      // richiesta disconnessione client da unità robot
      if (multiplexer == ROBOT_DISCONNECT_REQ) {
        // verifica autenticazione richiesta
        if (connection_req_auth == authcode) {
          // reset ambiente
          setBehaviour(-1);
          connection_req_auth = -1;
          last_remote_direction = -1;
          self_protection_enabled = !self_protection_enabled;
          // reset timer
          clientLastReqMillis_ping = 0;

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"DISCONNECTED\",\"message\":\"Disconnesso dall'unità Robot con successo.\"}");
          client.println();

          // Logging
          Serial.println("[log] Client disconnesso con successo, ripristino ambiente unità robot.");
          Serial.println("[log] {behaviour_selector=-1, connection_req_auth=-1, last_remote_direction=-1, self_protection_enabled=false, clientLastReqMillis_ping=0}");
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta dati batteria
      if (multiplexer == ROBOT_GET_BATTERY) {
        if (connection_req_auth == authcode) {
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\",\"data\":");
          client.print("{\"voltage\":");
          client.print(battery.voltage());
          client.print(",\"level\":");
          client.print(battery.level());
          client.print("}}");
          client.println();

          // Logging
          Serial.print("[wifi] Client: ROBOT_GETBATTERY -> ");
          Serial.print(battery.voltage());
          Serial.print("mV | ");
          Serial.print(battery.level());
          Serial.println("%");
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta impostazione modalità operativa
      if (multiplexer == ROBOT_SET_MODE) {
        // verifica autenticazione richiesta
        if (connection_req_auth == authcode) {
          // reset velocità
          setMotorsSpeed(default_speed);
          // impostazione modalità
          setBehaviour(opmode);

          // verifica attivazione ventola
          if (opmode == 2 || opmode == 3 || opmode == 4) {
            digitalWrite(fan_mosfet, HIGH);
          } else {
            digitalWrite(fan_mosfet, LOW);
          }

          if (opmode == -1) {
            stopMotors();
          }

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\",\"message\":\"Modalità operativa impostata su: ");
          switch (opmode) {
            case 0:
              client.print("Controllo Remoto[0].\"}");
              break;
            case 1:
              client.print("Blockly[1].\"}");
              break;
            default:
              client.print("(todo).\"}");
              break;
          }
          client.println();

          // Logging
          Serial.println("[wifi] Client: ROBOT_SETMODE.");
          Serial.print("[log] Impostazione modalità operativa -> behaviour_selector = ");
          Serial.println(behaviour_selector);
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta dati sensori sharp ir
      if (multiplexer == ROBOT_GET_SENSORS) {
        if (connection_req_auth == authcode) {
          // variabile d'appoggio per distanza
          short dist_copy = -1;

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\",\"data\":");
          if (sensorRequested == "front-right") {
            dist_copy = distance_fr;
            client.print(distance_fr);
          } else if (sensorRequested == "front-left") {
            dist_copy = distance_fl;
            client.print(distance_fl);
          } else if (sensorRequested == "side-right") {
            dist_copy = distance_sr;
            client.print(distance_sr);
          } else if (sensorRequested == "side-left") {
            dist_copy = distance_sl;
            client.print(distance_sl);
          }
          client.print("}");
          client.println();

          // Logging
          Serial.println("[wifi] Client: ROBOT_GET_SENSORS.");
          Serial.print("[log] ROBOT_GET_SENSORS -> ");
          Serial.print(sensorRequested);
          Serial.print(" = ");
          Serial.println(dist_copy);
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta accensione/spegnimento ventola d'aspirazione
      if (multiplexer == ROBOT_SET_FAN) {
        if (connection_req_auth == authcode) {
          // verifica che il parametro rientro nei limiti accettati
          fanStatus = constrain(fanStatus, 0, 1);

          // imposto status pin dedicato a ventola (D6)
          (fanStatus == 1) ? digitalWrite(fan_mosfet, HIGH) : digitalWrite(fan_mosfet, LOW);
          // gestione crank tensione batteria, reset timer
          prevMillis_battery = millis();

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\"}");
          client.println();

          // Logging
          Serial.print("[wifi] Client: ROBOT_SET_FAN -> ");
          Serial.println(fanStatus);

        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta ping
      if (multiplexer == ROBOT_GET_PING) {
        if (connection_req_auth == authcode) {

          // timing
          clientLastReqMillis_ping = millis();
          // attivazione flag
          // updatecurrentMillisPing = true;

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\"}");
          client.println();

          // Logging
          //timestamp_log = millisToString(clientLastReqMillis_ping / 1000);
          Serial.print("[wifi] Client: ROBOT_GET_PING -> OK | timestamp=");
          Serial.println(clientLastReqMillis_ping);
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // richiesta impostazione velocità motori
      if (multiplexer == MOTORS_SET_SPEED) {
        if (connection_req_auth == authcode) {
          uint8_t newSpeed;

          // verifica che il parametro rientro nei limiti accettati
          mspeed = constrain(mspeed, 1, 5);
          // parametro scalato in pwm
          newSpeed = map(mspeed, 1, 5, 50, 250);
          // todo: correzzione per match velocità default_speed
          newSpeed = (newSpeed == 200) ? 180 : newSpeed;
          // scrittura nuova velocità
          setMotorsSpeed(newSpeed);

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\",\"message\":\"Velocità: ");
          client.print(newSpeed);
          client.print("}");
          client.println();

          // Logging
          Serial.println("[wifi] Client: MOTORS_SET_SPEED");
          Serial.print("[info] Impostazione velocità motori -> m_speed = ");
          Serial.println(newSpeed);
        } else {
          // richiesta HTTP non autenticata
          client.println("HTTP/1.1 401 Unauthorized\nContent-type: application/json\nAccess-Control-Allow-Origin: *\n");
          client.println("{\"status\":\"ERROR\",\"message\":\"Errore, richiesta non autenticata.\"}\n");
        }
      }

      // OLD: if(currentLine.endsWith("POST /api/motors/forward")) {
      // richiesta movimento motori in direzione frontale
      if ( multiplexer == MOTORS_FORWARD_DELAY &&
           connection_req_auth == authcode) {
        // si verifica che il movimento sia disponibile nei limiti dei bordi bubble band
        if ( (distance_fl > bubbleBandBounds[0]) ||
             (distance_fr > bubbleBandBounds[0])) {
          // avanti
          forwardMotors(mdelay);
          // imposto la direzione imposta (utile per controllo remoto)
          if (behaviour_selector == 0) {
            last_remote_direction = 0;
          }

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\"}");
          client.println();

          // Logging
          Serial.print("[wifi] MOTORS_FORWARD_DELAY : ");
          Serial.println(mdelay);
        } else {
          // HTTP response
          client.println("HTTP/1.1 406 Not Acceptable");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"ERROR\",\"message\":\"FRONT_OBSTACLES\"}");
          client.println();

          // Logging
          Serial.println("[wifi] MOTORS_FORWARD_DELAY : FRONT_OBSTACLES");
        }

        // richiesta rotazione motori verso sinistra
      } else if ( multiplexer == MOTORS_LEFT_DELAY &&
                  connection_req_auth == authcode) {
        // si verifica che il movimento sia disponibile nei limiti dei bordi bubble band
        if (distance_sl > bubbleBandBounds[1]) {
          // sinistra
          leftMotors(mdelay);
          // imposto la direzione imposta (utile per controllo remoto)
          if (behaviour_selector == 0) {
            last_remote_direction = 1;
          }

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\"}");
          client.println();

          // Logging
          Serial.print("[wifi] MOTORS_LEFT_DELAY : ");
          Serial.println(mdelay);
        } else {
          // HTTP response
          client.println("HTTP/1.1 406 Not Acceptable");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"ERROR\",\"message\":\"LEFT_OBSTACLES\"}");
          client.println();

          // Logging
          Serial.println("[wifi] MOTORS_LEFT_DELAY : LEFT_OBSTACLES");
        }

        // richiesta rotazione motori verso destra
      } else if ( multiplexer == MOTORS_RIGHT_DELAY &&
                  connection_req_auth == authcode) {
        // si verifica che il movimento sia disponibile nei limiti dei bordi bubble band
        if (distance_sr > bubbleBandBounds[1]) {
          // destra
          rightMotors(mdelay);
          // imposto la direzione imposta (utile per controllo remoto)
          if (behaviour_selector == 0) {
            last_remote_direction = 2;
          }

          // HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"OK\"}");
          client.println();

          // Logging
          Serial.print("[wifi] MOTORS_RIGHT_DELAY : ");
          Serial.println(mdelay);
        } else {
          // HTTP response
          client.println("HTTP/1.1 406 Not Acceptable");
          client.println("Content-type: application/json");
          client.println("Access-Control-Allow-Origin: *");
          client.println();
          client.print("{\"status\":\"ERROR\",\"message\":\"RIGHT_OBSTACLES\"}");
          client.println();

          // Logging
          Serial.println("[wifi] MOTORS_RIGHT_DELAY : RIGHT_OBSTACLES");
        }
        // richiesta movimento motori in retromarcia
      } else if ( multiplexer == MOTORS_BACKWARD_DELAY &&
                  connection_req_auth == authcode) {
        // verifica autenticazione richiesta
        client.println("HTTP/1.1 200 OK");
        client.println("Content-type: application/json");
        client.println("Access-Control-Allow-Origin: *");
        client.println();
        client.print("{\"status\":\"OK\"}");
        client.println();

        backwardMotors(mdelay);
        // imposto la direzione imposta (utile per controllo remoto)
        if (behaviour_selector == 0) {
          last_remote_direction = 3;
        }

        // Logging
        Serial.print("[wifi] MOTORS_BACKWARD_DELAY : ");
        Serial.println(mdelay);
        // richiesta di fermare i motori
      } else if ( multiplexer == MOTORS_STOP &&
                  connection_req_auth == authcode) {
        client.println("HTTP/1.1 200 OK");
        client.println("Content-type: application/json");
        client.println("Access-Control-Allow-Origin: *");
        client.println();
        client.print("{\"status\":\"OK\"}");
        client.println();

        stopMotors();
        // imposto la direzione imposta (utile per controllo remoto)
        if (behaviour_selector == 0) {
          last_remote_direction = 4;
        }

        // Logging
        Serial.println("[wifi] MOTORS_STOP");
      } else if (multiplexer == ROBOT_SET_BLOCKLY &&
                 connection_req_auth == authcode) {

        client.println("HTTP/1.1 200 OK");
        client.println("Content-type: application/json");
        client.println("Access-Control-Allow-Origin: *");
        client.println();

        // Logging
        Serial.print("[wifi] ROBOT_SET_BLOCKLY | blocklyStatus=");

        if (blocklyStatus == 0) {
          // inizio esecuzione programma blockly
          wasBBXon = 0;
          client.print("{\"status\":\"OK\"}");

          // Logging
          Serial.println(blocklyStatus);
        } else if (blocklyStatus == 1) {
          // fine esecuzione programma blockly
          // verifica occorrenza intervento BubbleBand Extended
          client.print("{\"status\":");
          client.print(wasBBXon);
          client.print("}");

          // Logging
          Serial.print(blocklyStatus);
          Serial.print(", | wasBBXon=");
          Serial.println(wasBBXon);
        }

        client.println();
      }

      // chiusura connessione
      client.stop();
      //Serial.println("client disconnected");
    }
    /*
      ############################## FINE: Arduino Web Server ##############################
    */

    // check periodico comunicazione con client (watchdog)
    if (connection_req_auth != -1) {
      currentMillis_ping = millis();
      if ((currentMillis_ping - clientLastReqMillis_ping > interval_ping) && (clientLastReqMillis_ping != 0)) {
        // se il robot non è in modalità "pulizia"
        if ( behaviour_selector < 2 ) {
          // stop
          stopMotors();

          // Logging
          Serial.println("[log] Comunicazione con il client persa, ripristino configurazione robot.");
          // reset ambiente
          setBehaviour(-1);
          connection_req_auth = -1;
          last_remote_direction = -1;
          self_protection_enabled = !self_protection_enabled;
          // reset timer
          clientLastReqMillis_ping = 0;

          delay(100);
        }
      }
    }
    /*
      if(updatecurrentMillisPing == true) {
      prevMillis_ping = currentMillis_ping;

      updatecurrentMillisPing = false;
      }
    */

    // check periodo del livello di batteria dell'unità robot
    currentMillis_battery = millis();
    if (currentMillis_battery - prevMillis_battery > interval_battery) {
      prevMillis_battery = currentMillis_battery;
      checkBattery();
    }

    // controllo che la carica della batteria sia sufficiente per operare
    if (is_battery_charged) {
      // misurazione e salvataggio distanze da sensori sharp ir
      distance_fl = sensor_fl.getDist();
      distance_fr = sensor_fr.getDist();
      distance_sr = sensor_sr.getDist();
      distance_sl = sensor_sl.getDist();

      /*
         Behaviour Selector
         0. Remote Control
         1. Blockly
         2. Random Walk (Coverage Algorithms)
         3. Boustrophedon (Coverage Algorithms)
         4. Spiral /w Wall Follow (Coverage Algorithms)
      */
      switch (behaviour_selector) {
        case 0:
          selfProtection(0, 0x00);
          break;
        case 1:
          selfProtection(1, 0x00);
          break;
        case 2:
          randomWalk();
          break;
        case 3:
          boustrophedon();
          break;
        case 4:
          spiral();
          break;
        default:
          // -1 (void)
          break;
      }

      // piccolo ritardo
      delay(1);

      /*
        ############################## INIZIO: Debugging ##############################
      */
      /*
        if (Serial.available() > 0) {
        incomingByte = Serial.read();
        //Serial.print("received: ");
        //Serial.println(incomingByte, DEC);

        if (incomingByte == 97) {
          // a
        }
        }
      */
      /*
        ############################### FINE: Debugging ###############################
      */


    } else {
      // batteria scarica
      digitalWrite(fan_mosfet, LOW);
      stopMotors();

      Serial.println("[log] Livello di batteria basso, il robot verrà arrestato a breve.");

      delay(1000);
      exit(0);
    }
  }
}
