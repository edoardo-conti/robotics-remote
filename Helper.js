import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Button,
  View,
  SafeAreaView,
  Text,
  ActivityIndicator,
  TouchableWithoutFeedback,
  ScrollView,
  RefreshControl,
  Image,
  Alert,
  TouchableOpacity,
  Platform,
  ImageBackground,
} from "react-native";
import Constants from "expo-constants";
import { useAsyncStorage } from "@react-native-community/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

import * as Animatable from 'react-native-animatable';

import LottieView from "lottie-react-native";

import useInterval from "@use-it/interval";

import axios from "axios";
import BlocklyPage, { getCode, runCode } from "./BlocklyPage";
import SwiperComponent from "./areaCoveragePage";

const instance = axios.create({
  baseURL: "http://arduino-wifi-robot-0df8/api",
  //timeout: 1000,
});

/*
 * Sprites
 */
const sprites = {
  robot: require("./assets/robot_palette2.png"),
  robotForward: require("./assets/robot_forward.png"),
  robotBackwards: require("./assets/robot_backward.png"),
  robotTurnLeft: require("./assets/robot_turn_left.png"),
  robotTurnRight: require("./assets/robot_turn_right.png"),
  arrow: require("./assets/arrow_min_white.png"),
};

export function HomeScreen({ navigation }) {
  // robot connection status
  const [isRobotConnected, setRobotConnected] = useState(false);
  const [robotAuthCode, setrobotAuthCode] = useState(-1);
  const { getItem, setItem, removeItem } = useAsyncStorage("@robot_connection");
  // robot operating mode
  const [robotOPmode, setrobotOPmode] = useState(0);
  // robot gfx
  const [robotMovement, setRobotMovement] = useState("stop");
  // battery
  const [isBattLoading, setBattLoading] = useState(true);
  const [battery, setBattery] = useState([]);
  // button connection
  const [isConnLoading, setConnLoading] = useState(false);
  // refresh
  const [refreshing, setRefreshing] = React.useState(false);
  // timer Round Trip Time
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [pingCounter, setPingCounter] = useState(0);
  const [RTT, setRTT] = useState(500);

  //const onRefresh = React.useCallback(() => {
  function onRefresh() {
    setRefreshing(true);

    getRobotInfo(robotAuthCode).then(function (response) {
      setRefreshing(false);
    });

    //wait(2000).then(() => setRefreshing(false));
  }
  //}, []);

  const readItemFromStorage = async () => {
    var jsonValue = await getItem();

    if (jsonValue != null) {
      var jsonValueParsed = JSON.parse(jsonValue);

      setrobotAuthCode(jsonValueParsed.authcode);
      setRobotConnected(jsonValueParsed.connected);

      // load sensors (todo)
      getRobotInfo(jsonValueParsed.authcode);

      // logging
      // console.log(jsonValueParsed);
    } else {
      // console.log(jsonValue); == null
      // niente da fare, unità robot disconnessa
    }
  };
  const writeItemToStorage = async (newValue) => {
    await setItem(newValue);

    var robotData = JSON.parse(newValue);

    setrobotAuthCode(robotData.authcode);
    setRobotConnected(robotData.connected);

    // logging
    // console.log(robotData);
  };
  const deleteItemFromStorage = async () => {
    await removeItem();

    setrobotAuthCode(-1);
    setRobotConnected(false);
    setrobotOPmode(0);

    // logging
    console.log("disconnessione...");
  };

  function connectRobot() {
    // attivo caricamento
    setConnLoading(true);

    instance
      .get("/connect", {
        timeout: 4000, // timeout maggiore per il tempo di connessione all'unità robot
      })
      .then(function (response) {
        if (response.data.status == "CONNECTED") {
          // alert(response.data.message);

          var json_data = {
            connected: true,
            authcode: response.data.auth,
          };
          var jsonValue = JSON.stringify(json_data);

          // store data
          writeItemToStorage(jsonValue);
          // load sensors (todo)
          getRobotInfo(response.data.auth);
          // start timer ping
          setIsTimerRunning(true);
        }
      })
      .catch(function (error) {
        if (error.response != null) {
          Alert.alert(
            "Impossibile connettersi all'unità Robot",
            error.response.data.message,
            [
              {
                text: "Chiudi",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel",
              },
              { text: "Riprova", onPress: () => connectRobot() },
            ],
            { cancelable: false }
          );
        } else {
          Alert.alert(
            "Impossibile connettersi all'unità Robot",
            "Verificare l'ambiente di rete",
            [
              {
                text: "Chiudi",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel",
              },
              { text: "Riprova", onPress: () => connectRobot() },
            ],
            { cancelable: false }
          );
        }
      })
      .finally(function () {
        setConnLoading(false);
      });

    // debug (todo)
    // da rimuovere, utilizzato per entrare in grafica senza conferma http
    //setrobotAuthCode(-1);
    //setRobotConnected(true);
  }

  function disconnectRobot() {
    // debugging
    deleteItemFromStorage();
    setIsTimerRunning(false);

    instance
      .get("/disconnect?auth=" + robotAuthCode)
      .then(function (response) {
        if (response.data.status == "DISCONNECTED") {
          // alert(response.data.message);

          // pulizia storage
          deleteItemFromStorage();
          // stop timer ping
          setIsTimerRunning(false);

          // play animazione login
          if (Platform.OS != "android") {
            this.animation.play(0, 160);
          }
        }
      })
      .catch(function (error) {
        if (error.response != null) {
          //alert(error.response.data.message);
        }
      });
  }

  function getRobotInfo(authcode) {
    return instance
      .get("/sensors/battery?auth=" + authcode)
      .then(function (response) {
        if (response.data.status == "OK") {
          setBattery(response.data.data);
          setBattLoading(false);

          //console.log(response.data);
        }
      })
      .catch(function (error) {
        //alert("errore recupero info batteria robot");
      });
  }

  function gotoBlockly() {
    // todo: check navigation.jumpTo('Profile', { owner: 'Michaś' });
    navigation.navigate("Blockly", {
      robotAuthCodeBlockly: robotAuthCode,
      RTT: RTT,
    });

    // controllo che la modalità non sia già stata impostata precedentemente
    if (robotOPmode != 1) {
      instance
        .post("/setmode?op=1&auth=" + robotAuthCode)
        .then(function (response) {
          setrobotOPmode(1); //Blockly
        })
        .catch(function (error) {
          // todo
        });
    }
  }

  function gotoAlgs() {
    navigation.navigate("areaCoverageScreen", {
      robotAuthCodeAlgs: robotAuthCode,
    });

    // controllo che la modalità non sia già stata impostata precedentemente
    if (robotOPmode != -1) {
      instance
        .post("/setmode?op=-1&auth=" + robotAuthCode)
        .then(function (response) {
          setrobotOPmode(-1); // Void
        })
        .catch(function (error) {
          // todo
        });
    }
  }

  function enableRemoteControl() {
    // controllo che la modalità non sia già stata impostata precedentemente
    if (robotOPmode != 0) {
      instance
        .post("/setmode?op=0&auth=" + robotAuthCode)
        .then(function (response) {
          setrobotOPmode(0); //Blockly
        })
        .catch(function (error) {
          // todo
        });
    }
  }

  function motorMove(direction) {
    var urlReq = "/motors/";

    switch (direction) {
      case "stop":
        urlReq += "stop?auth=" + robotAuthCode;
        break;
      default:
        urlReq += direction + "?delay=0&auth=" + robotAuthCode;
        break;
    }

    instance
      .post(urlReq)
      .then(function (response) {
        //
        setRobotMovement(direction);
      })
      .catch(function (error) {
        // wobble robot sprite 
        this.wobble();
      });
  }

  const d = new Date();
  useInterval(
    () => {
      // TODO: timer per controllo connessione con robot
      if (isRobotConnected == true) {
        // start
        let startTime = Date.now();

        instance
          .post("/ping?auth=" + robotAuthCode, {
            timeout: 3000,
          })
          .then(function (response) {
            // incremento counter ping
            setPingCounter((currentCount) => currentCount + 1);

            // calc RTT
            let now = Date.now(),
              seconds = 1e3 * Math.floor((now - startTime) / 1e3).toFixed(0),
              milliseconds = Math.floor((now - startTime) % 1e3),
              currentRTT = seconds + milliseconds;

            // se maggiore, nuovo massimo valore
            if (currentRTT > RTT) {
              setRTT(currentRTT);
            }
          })
          .catch(function (error) {
            // TODO: verificare se corretto farlo ->
            setIsTimerRunning(false);
            
            Alert.alert(
              "Connessione con unità Robot persa",
              "Vuoi riconnetterti? ",
              [
                {
                  text: "No",
                  onPress: () => { 
                    disconnectRobot(); 
                    // TODO: verificare se corretto farlo ->
                    navigation.navigate("Home"); 
                  },
                  style: "cancel",
                },
                { text: "Si", onPress: () => connectRobot() },
              ],
              { cancelable: false }
            );
          });
      }
    },
    isTimerRunning ? 15000 : null
  );

  useFocusEffect(
    React.useCallback(() => {
      // alert('Screen was focused');
      // Do something when the screen is focused
      return () => {
        // alert('Screen was unfocused');
        // Do something when the screen is unfocused
        // Useful for cleanup functions
      };
    }, [])
  );

  useEffect(() => {
    // recupero informazioni salvate localmente nel dispositivo
    // per tenere traccia della connessione tra client e unità robot
    readItemFromStorage();

    //this.animation.play();
    if (!isRobotConnected && Platform.OS != "android") {
      this.animation.play(0, 160);
    }
  }, []);

  robotSpriteRef = ref => this.spriteRobot = ref;

  wobble = () => this.spriteRobot.wobble(500);

  return (
    <SafeAreaView style={styles.container}>
      {isRobotConnected ? (
        <ScrollView
          contentInsetAdjustmentBehavior={"always"}
          contentContainerStyle={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {isRobotConnected ? /*<PostHeader />*/ null : null}

          <ImageBackground
            source={require("./assets/test.jpg")}
            style={styles.mainBackgroundPalette}
            resizeMode="stretch"
          >
            <View style={styles.viewRobot}>
              {robotOPmode != 0 ? (
                <View style={styles.enableRemoteControl}>
                  <LinearGradient
                    colors={["rgba(255,255,255,.4)", "#ff6532"]}
                    style={styles.enableRCLineaGradient}
                  >
                    <TouchableOpacity
                      onPress={enableRemoteControl}
                      style={styles.enableRemoteControlButton}
                    >
                      <Text style={styles.enableRemoteControlButtonText}>
                        Abilita Controllo Remoto
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ) : null}
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("forward")}
                onPressOut={() => motorMove("stop")}
              >
                <Image
                  source={sprites.arrow}
                  style={[styles.robotArrowsCommand, styles.arrowUp]}
                />
              </TouchableWithoutFeedback>
              <View style={styles.viewRobotCenterRow}>
                <TouchableWithoutFeedback
                  onPressIn={() => motorMove("left")}
                  onPressOut={() => motorMove("stop")}
                >
                  <Image
                    source={sprites.arrow}
                    style={[styles.robotArrowsCommand, styles.arrowLeft]}
                  />
                </TouchableWithoutFeedback>
                {robotMovement == "stop" ? (
                  <Animatable.Image source={sprites.robot} ref={this.robotSpriteRef} style={styles.robotSprite} />
                ) : null}
                {robotMovement == "forward" ? (
                  <Image
                    source={sprites.robotForward}
                    style={styles.robotSprite}
                  />
                ) : null}
                {robotMovement == "left" ? (
                  <Image
                    source={sprites.robotTurnLeft}
                    style={styles.robotSprite}
                  />
                ) : null}
                {robotMovement == "right" ? (
                  <Image
                    source={sprites.robotTurnRight}
                    style={styles.robotSprite}
                  />
                ) : null}
                {robotMovement == "backward" ? (
                  <Image
                    source={sprites.robotBackwards}
                    style={styles.robotSprite}
                  />
                ) : null}
                <TouchableWithoutFeedback
                  onPressIn={() => motorMove("right")}
                  onPressOut={() => motorMove("stop")}
                >
                  <Image
                    source={sprites.arrow}
                    style={[styles.robotArrowsCommand, styles.arrowRight]}
                  />
                </TouchableWithoutFeedback>
              </View>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("backward")}
                onPressOut={() => motorMove("stop")}
              >
                <Image
                  source={sprites.arrow}
                  style={[styles.robotArrowsCommand, styles.arrowDown]}
                />
              </TouchableWithoutFeedback>
            </View>
          </ImageBackground>

          <View style={styles.viewOptions}>
            <View style={styles.batteryView}>
              <Text style={styles.tabViewTitle}>BATTERIA</Text>
              <View style={styles.tabView}>
                {isBattLoading ? (
                  <ActivityIndicator />
                ) : (
                  <View>
                    <View style={styles.batteryViewRow}>
                      <Text style={styles.batteryViewLabel}>
                        Tensione{`\t\t\t`}
                      </Text>
                      <Text style={styles.batteryViewVoltage}>
                        {(battery.voltage / 1000).toFixed(2)}V
                      </Text>
                    </View>
                    <View
                      style={[styles.batteryViewRow, styles.batteryViewRowLast]}
                    >
                      <Text style={styles.batteryViewLabel}>
                        Livello carica{`\t\t`}
                      </Text>
                      <Text style={styles.batteryViewLevel}>
                        {battery.level}%
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.tabViewTitle}>FUNZIONALITÀ</Text>
            <View style={[styles.tabView, styles.tabViewAnim]}>
              <TouchableOpacity
                style={[styles.tabViewButton, styles.tabViewButtonAnim]}
                onPress={gotoBlockly}
              >
                <Text style={styles.tabViewButtonTitle}>Programma Robot</Text>
                <Text style={styles.tabViewButtonDesc}>
                  Un approccio dedicato alla programmazione a blocchi.
                </Text>
              </TouchableOpacity>
              <View style={styles.tabViewAnimationContainer}>
                {Platform.OS == "android" ? (
                  <Image
                    style={styles.tabViewAnimation}
                    source={require("./assets/images/boy-and-mobile-interactions.png")}
                    resizeMode="cover"
                  />
                ) : (
                  <LottieView
                    source={require("./assets/animations/boy-and-mobile-interactions.json")}
                    autoPlay
                    loop={true}
                    style={styles.tabViewAnimation}
                    resizeMode="cover"
                  />
                )}
              </View>
            </View>
            <View style={[styles.tabView, styles.tabViewAnim]}>
              <TouchableOpacity
                style={[styles.tabViewButton, styles.tabViewButtonAnim]}
                onPress={gotoAlgs}
              >
                <Text style={styles.tabViewButtonTitle}>
                  Modalità Esplorazione
                </Text>
                <Text style={styles.tabViewButtonDesc}>
                  Scopri gli algoritmi di massima copertura di un'area.
                </Text>
              </TouchableOpacity>
              <View style={styles.tabViewAnimationContainer}>
                {Platform.OS == "android" ? (
                  <Image
                    style={styles.tabViewAnimation}
                    source={require("./assets/images/mobile-tap-interaction-animation.png")}
                    resizeMode="cover"
                  />
                ) : (
                  <LottieView
                    source={require("./assets/animations/mobile-tap-interaction-animation.json")}
                    autoPlay
                    loop={true}
                    style={[
                      styles.tabViewAnimation,
                      styles.tabViewAnimationAlgs,
                    ]}
                    resizeMode="cover"
                  />
                )}
              </View>
            </View>

            <Text style={styles.tabViewTitle}>IMPOSTAZIONI</Text>
            <View style={styles.tabView}>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={disconnectRobot}
              >
                <Text style={styles.disconnectButtonText}>
                  Disconnetti Robot
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.viewLoggedOut}>
          <View style={styles.viewLoggedOutAnim}>
            {Platform.OS == "android" ? (
              <Image
                style={styles.viewLoggedOutAndroidImage}
                source={require("./assets/images/freelancers-life.png")}
                resizeMode="contain"
              />
            ) : (
              <LottieView
                source={require("./assets/animations/freelancers-life.json")}
                //autoPlay
                loop={false}
                style={styles.viewLoggedOutAnimation}
                resizeMode="cover"
                ref={(animation) => {
                  this.animation = animation;
                }}
              />
            )}
          </View>
          <View style={styles.viewLoggedOutButton}>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={connectRobot}
            >
              <Text style={styles.connectButtonText}>
                {isConnLoading
                  ? <ActivityIndicator color="#fff" />
                  : "Connettiti al Robot"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function BlocklyScreen({ route, navigation }) {
  const { robotAuthCodeBlockly, RTT } = route.params;

  // cambio settings Stack.Navigator
  navigation.setOptions({
    headerLargeTitle: false,
    //headerHideShadow: false,
  });

  return (
    <BlocklyPage
      robotAuthCodeBlockly={robotAuthCodeBlockly}
      RTT={RTT}
      navigation={navigation}
    />
  );
}

export function areaCoverageScreen({ route, navigation }) {
  const { robotAuthCodeAlgs } = route.params;

  // cambio settings Stack.Navigator
  navigation.setOptions({
    headerLargeTitle: false,
    headerHideShadow: false,
  });

  React.useEffect(() => {
    //alert();
    navigation.addListener("beforeRemove", (e, robotOPmode, robotAuthCode) => {
      if (robotOPmode != -1) {
        instance
          .post("/setmode?op=-1&auth=" + robotAuthCode)
          .then(function (response) {
            setrobotOPmode(-1); // Void
          })
          .catch(function (error) {
            // todo
          });
      }
    }),
      [navigation];
  });

  return <SwiperComponent robotAuthCodeAlgs={robotAuthCodeAlgs} />;
}

export function getCodeBlockly() {
  getCode();
}

export function runCodeBlockly() {
  runCode();
}

export function networkErrorAlert() {
  Alert.alert(
    "Impossibile completare l'operazione",
    "Verificare la connessione alla rete",
    [{ text: "OK" }],
    { cancelable: true }
  );
}

function Separator() {
  return <View style={styles.separator}></View>;
}

function PostHeader() {
  return (
    <ImageBackground
      source={require("./assets/postHeader.jpg")}
      style={styles.postHeader}
      imageStyle={{ resizeMode: "stretch" }}
    ></ImageBackground>
  );
}

const platformFont = Platform.OS === "android" ? "Roboto" : "Helvetica Neue";
const styles = StyleSheet.create({
  /*
   * ###### Stili Generali ######
   */
  container: {
    flex: 1,
    backgroundColor: "snow",
    fontFamily: platformFont,
    //marginTop: Constants.statusBarHeight,
  },
  separator: {
    marginVertical: 8,
    borderBottomColor: "#737373",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postHeader: {
    //flex: 1,
    //width: "100%",
    height: 50,
  },
  mainBackgroundPalette: {
    //flex: 1,
    //borderRadius: 15
    paddingBottom: 30,
    paddingTop: 15,
  },
  scrollView: {
    //flex: 1,
    //backgroundColor: "red"
  },
  tabView: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
  },
  tabViewTitle: {
    fontWeight: "bold",
    marginBottom: 5,
    letterSpacing: 1,
    color: "#515a83",
    fontSize: 12,
    marginTop: 20,
  },
  tabViewButton: {
    backgroundColor: "#f8f9fe",
    padding: 14,
    borderRadius: 5,
    //marginTop: 10,
  },
  tabViewButtonTitle: {
    fontSize: 18,
    fontFamily: platformFont,
    color: "#515a83",
    fontWeight: "700",
    marginBottom: 2,
  },
  tabViewButtonDesc: {
    fontSize: 12,
    fontFamily: platformFont,
    color: "#bdb9ba",
    letterSpacing: -0.2,
  },
  tabViewAnim: {
    flex: 1,
    flexDirection: "row",
    padding: 0,
  },
  tabViewButtonAnim: {
    flex: 2,
    margin: 10,
    marginRight: 0,
  },
  tabViewAnimationContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    // backgroundColor:'red', //debug
  },
  tabViewAnimation: {
    position: "absolute",
    width: "130%",
    height: "130%",
    right: "-19%",
    top: "-8%",
  },
  tabViewAnimationAlgs: {
    right: "-20%",
    top: "-5%",
  },
  /*
   * ###### Dashboard Robot ######
   */
  enableRemoteControl: {
    position: "absolute",
    width: "100%",
    height: 355,
    //backgroundColor: "rgba(0,0,0,.5)",
    //backgroundColor: "#ff6532",
    alignItems: "center",
    zIndex: 100,
    justifyContent: "center",
    top: -25,
  },
  enableRemoteControlButton: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  enableRemoteControlButtonText: {
    fontSize: 22,
    fontFamily: platformFont,
    color: "#6b52f6",
    fontWeight: "500",
  },
  enableRCLineaGradient: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  viewRobot: {
    flex: 1,
    flexDirection: "column",
    flexWrap: "wrap",
    //justifyContent: "flex-start",
    justifyContent: "space-evenly",
    alignItems: "center",
    //backgroundColor: "red", // layout debug
    //paddingTop: Constants.statusBarHeight,
    height: 300,
  },
  viewRobotCenterRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  robotSprite: {
    flex: 1,
    width: 500,
    height: 500,
    resizeMode: "contain",
    zIndex: 1,
  },
  robotArrowsCommand: {
    width: 50,
    height: 50,
    //backgroundColor: "blue", // layout debug
    margin: 10,
  },
  arrowUp: {
    zIndex: 2,
  },
  arrowRight: {
    marginRight: 10,
    transform: [{ rotate: "90deg" }],
    zIndex: 2,
  },
  arrowLeft: {
    marginLeft: 10,
    transform: [{ rotate: "-90deg" }],
    zIndex: 2,
  },
  arrowDown: {
    transform: [{ rotate: "180deg" }],
    zIndex: 2,
  },
  viewOptions: {
    backgroundColor: "snow",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    //paddingTop: 30,
    shadowColor: "#752400",
    shadowOffset: {
      width: 0,
      height: -15,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginTop: -30,
  },
  /*
   * ###### Battery ######
   */
  batteryViewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginBottom: 15,
  },
  batteryViewRowLast: {
    marginBottom: 0,
  },
  batteryViewLabel: {
    fontSize: 16,
    fontFamily: platformFont,
    color: "#6b52f6",
    fontWeight: "500",
  },
  batteryViewVoltage: {
    fontSize: 16,
    fontFamily: platformFont,
    color: "#012e63",
    fontWeight: "500",
  },
  batteryViewLevel: {
    fontSize: 16,
    fontFamily: platformFont,
    color: "#012e63",
    fontWeight: "500",
  },
  /*
   * Settings
   */
  disconnectButton: {
    backgroundColor: "#ff6535",
    padding: 15,
    alignItems: "center",
    borderRadius: 15,
  },
  disconnectButtonText: {
    color: "#fff",
    fontFamily: platformFont,
    fontWeight: "700",
    fontSize: 15,
  },
  /*
   * Accesso
   */
  connectButton: {
    backgroundColor: "#ff6535",
    padding: 15,
    alignItems: "center",
    borderRadius: 15,
  },
  connectButtonText: {
    color: "#fff",
    fontFamily: platformFont,
    fontWeight: "700",
    fontSize: 15,
  },
  viewLoggedOut: {
    flex: 1,
    backgroundColor: "white",
    //backgroundColor: "red",
  },
  viewLoggedOutAnim: {
    flex: 5,
    justifyContent: "center",
    //backgroundColor: "blue",
  },
  viewLoggedOutButton: {
    flex: 1,
    paddingTop: 0,
    padding: 40,
    //backgroundColor: "green",
    justifyContent: "center",
  },
  viewLoggedOutAnimation: {},
});
