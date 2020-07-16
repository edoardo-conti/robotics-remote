import React, { Component } from "react";
import { Platform, ActivityIndicator, Alert } from "react-native";
import WebView from "react-native-webview";
import { useAsyncStorage } from "@react-native-community/async-storage";

import axios from "axios";

// da popolare
let authcode = -1;
let webref = null;

const instance = axios.create({
  baseURL: "http://10.0.0.116/api",
  //timeout: 1000,
});

const { getItem, setItem, removeItem } = useAsyncStorage("@blockly");

class BlocklyPage extends Component {
  constructor(props) {
    super(props);

    authcode = props.robotAuthCodeBlockly;
    navigation = props.navigation;
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

      if(code != '') {
        navigation.navigate('MyModal', {code: code});
      } else {
        Alert.alert(
          "Workspace vuoto",
          "Aggiungere dei blocchi per generare codice",
          [
            { text: "OK" }
          ],
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
    } else if(message.id == 3) {
      var data = message.data;

      if(data == 'LOAD') {
        // load workspace
        loadWorkspace();

      } else {
        // backup workspace
        backupWorkspace(data);

      }
    } else if(message.id >= 4) {
      alert(message.data);
    }

  }

  render() {
    return (
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
        onLoad={syntheticEvent => {
          loadWorkspace();
        }}
      />
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
    workspace_safe = workspace.replace(/(\r\n|\n|\r)/gm,"")
    
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
  const run = 'document.getElementById("getcode").click();true;';
  
  webref.injectJavaScript(run);
}
export function runCode() {
  const run = 'document.getElementById("runcode").click();true;';
  
  webref.injectJavaScript(run);
}

export default BlocklyPage;

