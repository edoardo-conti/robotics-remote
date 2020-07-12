import React from 'react';
import { Platform, ActivityIndicator, View } from "react-native";
import WebView from "react-native-webview";
// import Iframe from 'react-iframe';

import axios from 'axios';

const instance = axios.create({
    baseURL: 'http://10.0.0.116/api',
    //timeout: 1000, 
  });

function LoadingIndicatorView() {
  return <ActivityIndicator size='large' />
}

function sleeper(ms) {
return function(x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
};
}

// da popolare
let authcode = -1;

class BlocklyPage extends React.Component {
  constructor(props) {
    super(props);

    authcode = props.robotAuthCodeBlockly;
  }

  handleRequest(event) {
    var reqURL = event.nativeEvent.data + '&auth=' + authcode;
    //alert(reqURL);
    
    instance.post(reqURL)
    .then(sleeper(100))
    .then(function (response) {
      // 
    })
    .catch(function(error) {
      // 
    });
  }

  render() {
    // const js2inject = `var robotAuthCode = ` + authCode + `; true;`;

    return (
      <WebView
      style={{flex: 1}}
      source={{uri : 'https://edoardoconti.imfast.io/www/index.html'}}
      originWhitelist={['https://*']}
      javaScriptEnabled={true} //Enable Javascript support
      domStorageEnabled={true} //For the Cache
      onMessage={this.handleRequest}
      renderLoading={this.LoadingIndicatorView}
      startInLoadingState={true}
      cacheEnabled={false}
      incognito={true}
      />
      );
  }
    
}

export default BlocklyPage;