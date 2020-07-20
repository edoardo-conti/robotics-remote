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
  Platform
} from "react-native";
import Constants from "expo-constants";
import { useAsyncStorage } from "@react-native-community/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

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
  robot: require("./assets/robot.png"),
  arrow: require("./assets/arrow_min_white.png"),
};

export function HomeScreen({ navigation }) {
  // robot connection status
  const [isRobotConnected, setRobotConnected] = useState(false);
  const [robotAuthCode, setrobotAuthCode] = useState(-1);
  const { getItem, setItem, removeItem } = useAsyncStorage("@robot_connection");
  // robot operating mode
  const [robotOPmode, setrobotOPmode] = useState(0);
  // battery
  const [isBattLoading, setBattLoading] = useState(true);
  const [battery, setBattery] = useState([]);
  // button connection
  const [isConnLoading, setConnLoading] = useState(false);
  // refresh
  const [refreshing, setRefreshing] = React.useState(false);

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
    // attivo icona caricamento
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

          writeItemToStorage(jsonValue);

          // load sensors (todo)
          getRobotInfo(response.data.auth);
        }
      })
      .catch(function (error) {
        if (error.response != null) {
          alert(error.response.data.message);
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

    instance
      .get("/disconnect?auth=" + robotAuthCode)
      .then(function (response) {
        if (response.data.status == "DISCONNECTED") {
          // alert(response.data.message);

          deleteItemFromStorage();
        }
      })
      .catch(function (error) {
        if (error.response != null) {
          alert(error.response.data.message);
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
        alert("errore recupero info batteria robot");
      });
  }

  function gotoBlockly() {
    // todo: check navigation.jumpTo('Profile', { owner: 'Michaś' });
    navigation.navigate("Blockly", {
      robotAuthCodeBlockly: robotAuthCode,
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
      })
      .catch(function (error) {
        //
      });
  }

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
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {isRobotConnected ? (
        <LinearGradient
          colors={["#fea735", "#fe7235"]}
          style={styles.mainLineaGradient}
        >
          <ScrollView
            contentContainerStyle={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {robotOPmode == 0 ? (
              <View style={styles.viewRobot}>
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
                  <Image source={sprites.robot} style={styles.robotSprite} />
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
            ) : (
              <View style={styles.viewRobot}>
                <Button
                  onPress={enableRemoteControl}
                  title="Abilita controllo remoto"
                />
              </View>
            )}

            <View style={styles.viewOptions}>
              {isBattLoading ? (
                <ActivityIndicator />
              ) : (
                <View style={styles.batteryView}>
                  <Text style={styles.batteryViewTitle}>BATTERIA</Text>
                  <View style={styles.tabView}>
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
                </View>
              )}
              <View style={styles.tabView}>
                <FontAwesome5 name="code" size={32} color="black" />
                <TouchableOpacity
                  style={styles.tabViewButton}
                  onPress={gotoBlockly}
                >
                  <Text style={styles.tabViewButtonTittle}>Programma Robot</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tabView}>
                <FontAwesome5 name="braille" size={32} color="black" />
                <TouchableOpacity
                  style={styles.tabViewButton}
                  onPress={gotoAlgs}
                >
                  <Text style={styles.tabViewButtonTittle}>Area Coverage Algorithms</Text>
                </TouchableOpacity>
              </View>
              <Button title="Disconnetti Robot" onPress={disconnectRobot} />
            </View>
          </ScrollView>
        </LinearGradient>
      ) : isConnLoading ? (
        <ActivityIndicator />
      ) : (
        <SafeAreaView style={styles.container}>
          <Button onPress={connectRobot} title="Connetti Robot" />
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

export function BlocklyScreen({ route, navigation }) {
  /* Get the params */
  const { robotAuthCodeBlockly } = route.params;

  return (
    <BlocklyPage
      robotAuthCodeBlockly={robotAuthCodeBlockly}
      navigation={navigation}
    />
  );
}

export function areaCoverageScreen({ route, navigation }) {
  /* Get the params */
  const { robotAuthCodeAlgs } = route.params;

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
const platformFont = (Platform.OS === 'android') ? "Roboto" : "Helvetica Neue";
const styles = StyleSheet.create({
  /*
   * ###### Stili Generali ######
   */
  container: {
    //flex: 1,
    backgroundColor: "white",
    fontFamily: platformFont,
    //marginTop: Constants.statusBarHeight,
  },
  separator: {
    marginVertical: 8,
    borderBottomColor: "#737373",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mainLineaGradient: {
    //flex: 1,
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
  tabViewButton: {
    backgroundColor: "rgba(0,0,0,.04)",
    padding: 14,
    borderRadius: 5,
    marginTop: 10,
  },
  tabViewButtonTittle: {
    fontSize: 18,
    fontFamily: platformFont,
    color: "#012e63",
    fontWeight: "500",
  },

  /*
   * ###### Dashboard Robot ######
   */
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
    paddingTop: 30,
    shadowColor: "#752400",
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  /*
   * ###### Battery ######
   */
  batteryViewTitle: {
    fontWeight: "bold",
    marginBottom: 5,
    letterSpacing: 1,
    color: "#012e63",
    fontSize: 12,
  },
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
    color: "#3b6291",
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
});
