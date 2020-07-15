import React, { Component } from 'react'
import { StyleSheet, Text, View, Button, Alert } from 'react-native'

import Swiper from 'react-native-swiper'

import axios from "axios";

const instance = axios.create({
  baseURL: "http://10.0.0.116/api",
  //timeout: 1000,
});
const modes = ['Random Walk', 'Boustrophedon', 'Spiral Wall-Follow'];

export default class SwiperComponent extends Component {
    constructor(props) {
        super(props);

        this.state = { 
            authcode: props.robotAuthCodeAlgs,
            showStopRW: false,
            showStopB: false,
            showStopSWF: false
        };
        
        //navigation = props.navigation;
    }

    render() {
        return (
            <Swiper style={styles.wrapper} showsButtons={true}>
                <View style={styles.slide1}>
                <Text style={styles.text}>Random Walk</Text>
                <Text style={styles.emoji}>🚀</Text>
                <Button title="Avvia Navigazione Autonoma" onPress={() => { this.startExploring(modes[0]) } } />
                {this.state.showStopRW ? ( <Button title="Ferma Robot" onPress={() => { this.stopExploring(modes[0]) } } /> ) : null}
                </View>
                <View style={styles.slide2}>
                <Text style={styles.text}>Boustrophedon</Text>
                <Text style={styles.emoji}>🚇</Text>
                <Button title="Avvia Navigazione Autonoma" onPress={() => { this.startExploring(modes[1]) } } />
                {this.state.showStopB ? ( <Button title="Ferma Robot" onPress={() => { this.stopExploring(modes[1]) } } /> ) : null}
                </View>
                <View style={styles.slide3}>
                <Text style={styles.text}>Spiral Wall-Follow</Text>
                <Text style={styles.emoji}>🏝</Text>
                <Button title="Avvia Navigazione Autonoma" onPress={() => { this.startExploring(modes[2]) } } />
                {this.state.showStopSWF ? ( <Button title="Ferma Robot" onPress={() => { this.stopExploring(modes[2]) } } /> ) : null}
                </View>
            </Swiper>
        )
    }

    stopExploring = (algorithm) => {
        instance
        .post("/setmode?op=100&auth=" + this.state.authcode)
        .then(function (response) {
          // todo
        })
        .catch(function (error) {
          // todo
        });

        switch(algorithm) {
            case modes[0]:
                this.setState({ showStopRW: false });
                break;
            case modes[1]:
                this.setState({ showStopB: false });
                break;
            case modes[2]:
                this.setState({ showStopSWF: false });
                break;
            default: 
                
                break;
        }

    }

    startExploring = (algorithm) => {
        // verifica che sia l'unico algoritmo in esecuzione
        if(this.state.showStopRW == this.state.showStopB == this.state.showStopSWF == false) {
            /*
            * 2. Random Walk (Coverage Algorithms)
            * 3. Boustrophedon (Coverage Algorithms)
            * 4. Spiral (/w Wall follow after first hit) (Coverage Algorithms)
            */
            var mode = -1;

            switch(algorithm) {
                case modes[0]:
                    // Random Walk
                    mode = 2;
                    this.setState({ showStopRW: true });
                    break;
                case modes[1]:
                    // Boustrophedon
                    mode = 3;
                    this.setState({ showStopB: true });
                    break;
                case modes[2]:
                    // Spiral Wall-Follow
                    mode = 4;
                    this.setState({ showStopSWF: true });
                    break;
                default: 
                    
                    break;
            }

            instance
            .post("/setmode?op=" + mode + "&auth=" + this.state.authcode)
            .then(function (response) {
            // todo
            })
            .catch(function (error) {
            // todo
            });

        } else {
            alert("massimo 1 algoritmo in esecuzione.");
        }
    }
}

const styles = StyleSheet.create({
    wrapper: {},
    slide1: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#9DD6EB'
    },
    slide2: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#97CAE5'
    },
    slide3: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#92BBD9'
    },
    text: {
      color: '#fff',
      fontSize: 30,
      fontWeight: 'bold'
    },
    emoji: {
      fontSize: 100,
    }
  })