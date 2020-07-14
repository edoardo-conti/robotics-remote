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
} from "react-native";
import Constants from "expo-constants";
import { useAsyncStorage } from "@react-native-community/async-storage";

import axios from "axios";
import BlocklyPage, { getCode } from "./BlocklyPage";

const instance = axios.create({
  baseURL: "http://10.0.0.116/api",
  //timeout: 1000,
});

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
          alert(
            "Impossibile connettersi all'unità Robot, verificare l'ambiente di rete."
          );
        }
      })
      .finally(function () {
        setConnLoading(false);
      });
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
          setrobotOPmode(0);
          //setrobotAuthCode(-1);
          //setRobotConnected(false);
        }
      })
      .catch(function (error) {
        alert(error.response.data.message);
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
    navigation.navigate("Blockly", {
      robotAuthCodeBlockly: robotAuthCode,
    });

    // controllo che la modalità non sia già stata impostata precedentemente
    if (robotOPmode != 1) {
      instance
        .get("/setmode?op=1&auth=" + robotAuthCode)
        .then(function (response) {
          setrobotOPmode(1); //Blockly
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
        .get("/setmode?op=0&auth=" + robotAuthCode)
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

  useEffect(() => {
    // recupero informazioni salvate localmente nel dispositivo
    // per tenere traccia della connessione tra client e unità robot
    readItemFromStorage();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {isRobotConnected ? (
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
                source={require('./assets/arrow_2.png')} 
                style={styles.arrowUp}
                />
              </TouchableWithoutFeedback>
              <View style={styles.viewRobotCenterRow}>
                <TouchableWithoutFeedback
                  onPressIn={() => motorMove("left")}
                  onPressOut={() => motorMove("stop")}
                >
                  <Image 
                  source={require('./assets/arrow_2.png')} 
                  style={styles.arrowLeft}
                  />
                </TouchableWithoutFeedback>
                <Image 
                source={require('./assets/robot_sprite.png')} 
                style={styles.robotSprite}
                />
                <TouchableWithoutFeedback
                  onPressIn={() => motorMove("right")}
                  onPressOut={() => motorMove("stop")}
                >
                  <Image 
                  source={require('./assets/arrow_2.png')} 
                  style={styles.arrowRight}
                  />
                </TouchableWithoutFeedback>
              </View>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("backward")}
                onPressOut={() => motorMove("stop")}
              >
                <Image 
                source={require('./assets/arrow_2.png')} 
                style={styles.arrowDown}
                />
              </TouchableWithoutFeedback>
            </View>
          ) : (
            <Button
              onPress={enableRemoteControl}
              title="Abilita controllo remoto"
            />
          )}
          {isBattLoading ? (
            <ActivityIndicator />
          ) : (
            <Text>
              Batteria: {battery.voltage / 1000}V ({battery.level}%)
            </Text>
          )}
          <Button title="Programma Robot" onPress={gotoBlockly} />
          <Button title="Disconnetti Robot" onPress={disconnectRobot} />
        </ScrollView>
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

  return <BlocklyPage robotAuthCodeBlockly={robotAuthCodeBlockly} navigation={navigation} />;
}

export function getCodeBlockly() {
  getCode();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  scrollView: {
    flex: 1,
  },
  viewRobot: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start"
  },
  viewRobotCenterRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  robotSprite: {
    flex: 1,
    width: 500,
    height: 500,
    marginRight: 10,
    resizeMode: "contain"
  },
  arrowUp: {
    width: 50,
    height: 50,
    marginBottom: -150,
  },
  arrowRight: {
    width: 50,
    height: 50,
    marginRight: 10,
    transform: [{ rotate: '90deg' }]
  },
  arrowLeft: {
    width: 50,
    height: 50,
    marginLeft: 10,
    transform: [{ rotate: '-90deg' }]
  },
  arrowDown: {
    width: 50,
    height: 50,
    marginTop: -150,
    transform: [{ rotate: '180deg' }]
  },
});
