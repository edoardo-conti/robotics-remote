import React, { Component } from "react";
import { Platform, ActivityIndicator, Alert, View, Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import WebView from "react-native-webview";
import { useAsyncStorage } from "@react-native-community/async-storage";
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/styles/hljs';

import LottieView from "lottie-react-native";

import axios from "axios";

// da popolare
let authcode = -1;
let webref = null;
let modalVisible = false;

const instance = axios.create({
  //baseURL: "http://10.0.0.116/api",
  baseURL: "http://arduino-wifi-robot-0df8/api",
  //timeout: 1000,
});

const { getItem, setItem, removeItem } = useAsyncStorage("@blockly");

class BlocklyPage extends Component {
  constructor(props) {
    super(props);

    authcode = props.robotAuthCodeBlockly;
    navigation = props.navigation;

    this.state = { 
      modalVisible: false,
      codeAnimationVisible: true,
      code: "",
    }

    this.handleRequest = this.handleRequest.bind(this);
  }
  
  getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
  }

  hideAnimation = () => {
    this.setState({codeAnimationVisible: false})
  }

  async handleRequest(event) {
    var message = JSON.parse(event.nativeEvent.data);

    if (message.id == 0) {
      // motors requests
      var httpreq = message.url + "&auth=" + authcode;

      await instance
        .post(httpreq)
        .then(function (response) {
          //
        })
        .catch(function (e) {
          //
          alert("errore: " + e);
        });
    } else if (message.id == 1) {
      // get code
      var code = message.code;
      
      this.setState({code: code})

      if (code != "") {
        this.setState({modalVisible: true});

        setTimeout(this.hideAnimation, 1500);

        //navigation.navigate("MyModal", { code: code });
      } else {
        Alert.alert(
          "Workspace vuoto",
          "Aggiungere dei blocchi per generare codice",
          [{ text: "OK" }],
          { cancelable: false }
        );
      }
    } else if (message.id == 2) {
      // getDistance()

      var httpreq = "/sensors/" + message.sensor + "?auth=" + authcode;

      instance
        .get(httpreq)
        .then(function (response) {
          //alert(response);

          if (response.data.status == "OK") {
            const run = "window.sensorValue = " + response.data.data + ";true;";

            webref.injectJavaScript(run);
          }
        })
        .catch(function (e) {
          //
          alert("errore: " + e);
        });
    } else if (message.id == 3) {
      var data = message.data;

      if (data == "LOAD") {
        // load workspace
        loadWorkspace();
      } else {
        // backup workspace
        backupWorkspace(data);
      }
    } else if (message.id >= 4) {
      alert(message.data);
    }
  }

  render() {
    return (
      <View style={{ flex: 1, flexDirection: "column" }}>
        <View style={{ height: 0 }}>
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={this.state.modalVisible}
          onDismiss={() => { this.setState({modalVisible: false}) }}
          onRequestClose={() => { this.setState({modalVisible: false}) }}
        >
          <View style={styles.modalView}>
              {this.state.codeAnimationVisible ? (
                <View style={styles.codeAnimationContainer}><LottieView
                source={require("./assets/animations/code-window.json")}
                autoPlay
                loop={true}
                style={[
                  styles.codeAnimation,
                ]}
                resizeMode="cover"
              /></View>
              ) : (
              <SyntaxHighlighter 
              language='javascript' 
              //fontSize={16}
              //highlighter={"prism" || "hljs"}
              highlighter='hljs'
              >
                {this.state.code}
              </SyntaxHighlighter>
              )}
              <View style={styles.modalButtonsView}>
                <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonClose]}
                onPress={() => {
                  this.setState({modalVisible: false, codeAnimationVisible: true});
                }}
                >
                <Text style={styles.buttonText}>Chiudi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonRunCode]}
                onPress={runCode} 
                disabled={this.state.codeAnimationVisible}
                >
                <Text style={[styles.buttonText, styles.buttonRunCodeText]}>Esegui Codice</Text>
                </TouchableOpacity>
              </View>
          </View>
        </Modal>
        </View>

        <WebView
          ref={(r) => (webref = r)}
          style={{ flex: 1 }}
          source={{ uri: "https://edoardoconti.imfast.io/www/index.html" }}
          originWhitelist={["https://*"]}
          javaScriptEnabled={true} //Enable Javascript support
          domStorageEnabled={true} //For the Cache
          onMessage={this.handleRequest}
          renderLoading={this.LoadingIndicatorView}
          startInLoadingState={true}
          //cacheEnabled={false}
          incognito={true}
          onLoad={(syntheticEvent) => {
            loadWorkspace();
          }}
        />
      </View>
    );
  }
}

function LoadingIndicatorView() {
  return <ActivityIndicator size="large" />;
}

async function loadWorkspace() {
  var workspace = await getItem();

  if (workspace != null) {
    // rimozione line breaks \r\n , \n , \r
    workspace_safe = workspace.replace(/(\r\n|\n|\r)/gm, "");

    // inject js
    const run = "loadBlocklyWorkspace('" + workspace_safe + "');true;";
    webref.injectJavaScript(run);
  }
}
async function backupWorkspace(newValue) {
  await setItem(newValue);
}
async function deleteWorkspace() {
  await removeItem();
}

export function getCode() {
  //const js = 'document.getElementById("getcode").click();true;';
  const js = 'window.getCode();true;';

  webref.injectJavaScript(js);
}
export function runCode() {
  //const js = 'document.getElementById("runcode").click();true;';
  const js = 'window.runCode();true;';

  webref.injectJavaScript(js);
}

export default BlocklyPage;

const styles = StyleSheet.create({
  modalView: {
    flex: 1,
  },
  modalButtonsView: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10,
  },
  modalButton: {
    padding: 14,
    margin: 10,
    alignSelf: 'stretch',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonClose: {
    backgroundColor: "#DDDDDD",
  },
  modalButtonRunCode: {
    //backgroundColor: "#ffa700",
    backgroundColor: "#ff6535",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRunCodeText: {
    color: '#fff',
  },
  codeAnimationContainer: {
    flex: 1,
  }, 
  codeAnimation: {

  }
});