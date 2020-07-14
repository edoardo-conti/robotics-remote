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
            <View>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("forward")}
                onPressOut={() => motorMove("stop")}
              >
                <Text style={styles.button}>Avanti</Text>
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("left")}
                onPressOut={() => motorMove("stop")}
              >
                <Text style={styles.button}>Sinistra</Text>
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("right")}
                onPressOut={() => motorMove("stop")}
              >
                <Text style={styles.button}>Destra</Text>
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPressIn={() => motorMove("backward")}
                onPressOut={() => motorMove("stop")}
              >
                <Text style={styles.button}>Indietro</Text>
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
        <Button onPress={connectRobot} title="Connetti Robot" />
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
  button: {
    alignItems: "center",
    backgroundColor: "#DDDDDD",
    padding: 10,
    margin: 10,
    textAlign: "center",
  },
});
