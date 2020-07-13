import React, { Component } from 'react';
import { Platform, ActivityIndicator } from "react-native";
import WebView from "react-native-webview";

import axios from 'axios';
import 'url-search-params-polyfill';

// import Iframe from 'react-iframe';

const instance = axios.create({
    baseURL: 'http://10.0.0.116/api',
    //timeout: 1000, 
  });

function LoadingIndicatorView() {
  return <ActivityIndicator size='large' />
}

// da popolare
let authcode = -1;

class BlocklyPage extends Component {
  constructor(props) {
    super(props);

    authcode = props.robotAuthCodeBlockly;
  }

  async handleRequest(event) {
    var message = JSON.parse(event.nativeEvent.data);

    if(message.id == 0) {
      // motors requests
      var httpreq = message.url + '&auth=' + authcode;
      //var query = new URLSearchParams(httpreq.split("?").pop());
      //var delay = query.get('delay');

      await instance.post(httpreq)
      .then(function (response) {
        // 
      })
      .catch(function(error) {
        // 
      });
    } else if(message.id == 1) {
      // get code
      var code = message.code;

      alert(code);
    }

  }

  render() {
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