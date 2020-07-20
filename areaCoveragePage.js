import React, { Component } from 'react'
import { StyleSheet, Text, View, Button, Alert, Animated } from 'react-native'
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer'
import Swiper from 'react-native-swiper'
import axios from "axios";

const instance = axios.create({
  //baseURL: "http://10.0.0.116/api",
  baseURL: "http://arduino-wifi-robot-0df8/api",
  timeout: 3000,
});
const modes = [
    [2, 'Random Walk'], 
    [3, 'Boustrophedon'], 
    [4, 'Spiral Wall-Follow']
];

export default class SwiperComponent extends Component {    
    constructor(props) {
        super(props);

        this.state = { 
            // robot authcode
            authcode: props.robotAuthCodeAlgs,
            // lock
            swiperScrollEnabled: true,
            swiperShowsButtons: true,
            // algorithm to run
            algRequested: -1,
            viewInLoading: -1,
        };
        
        //navigation = props.navigation;
    }

    render() {
        return (
            <Swiper style={styles.wrapper} showsButtons={this.state.swiperShowsButtons} scrollEnabled={this.state.swiperScrollEnabled} loop={false}>
            <View style={styles.slide1}>
                <Text style={styles.text}>Random Walk</Text>
                {(this.state.algRequested == 2) ? (
                    (this.state.viewInLoading == 0) ? (
                        <CountdownCircleTimer
                        isPlaying
                        duration={3}
                        size={100} 
                        strokeWidth={4}
                        colors={[['#fff', 1]]}
                        onComplete={() => {
                            this.runExploring(this.state.algRequested);
                            return [false, 0] // don't repeat animation
                        }}
                        >
                            {({ remainingTime, animatedColor }) => (
                            <Animated.Text style={{ color: animatedColor, fontSize: 35 }}>
                            {remainingTime}
                            </Animated.Text>
                            )}
                        </CountdownCircleTimer>
                    ) : (
                        <Button 
                        title="Ferma Robot" 
                        onPress={() => this.stopExploring(modes[0])} />
                    )
                ) : (
                    <Button 
                    title="Avvia Navigazione Autonoma" 
                    onPress={() => this.startExploring(modes[0])} />
                )
                }
            </View>
            <View style={styles.slide2}>
              <Text style={styles.text}>Boustrophedon</Text>
              {(this.state.algRequested == 3) ? (
                    (this.state.viewInLoading == 1) ? (
                        <CountdownCircleTimer
                        isPlaying
                        duration={3}
                        size={100} 
                        strokeWidth={4}
                        colors={[['#fff', 1]]}
                        onComplete={() => {
                            this.runExploring(this.state.algRequested);
                            return [false, 0] // don't repeat animation
                        }}
                        >
                            {({ remainingTime, animatedColor }) => (
                            <Animated.Text style={{ color: animatedColor, fontSize: 35 }}>
                            {remainingTime}
                            </Animated.Text>
                            )}
                        </CountdownCircleTimer>
                    ) : (
                        <Button 
                        title="Ferma Robot" 
                        onPress={() => this.stopExploring(modes[1])} />
                    )
                ) : (
                    <Button 
                    title="Avvia Navigazione Autonoma" 
                    onPress={() => this.startExploring(modes[1])} />
                )
                }
            </View>
            <View style={styles.slide3}>
              <Text style={styles.text}>Spiral <Text style={styles.smalltext}>(/w Wall-Follow)</Text></Text>
              {(this.state.algRequested == 4) ? (
                    (this.state.viewInLoading == 2) ? (
                        <CountdownCircleTimer
                        isPlaying
                        duration={3}
                        size={100} 
                        strokeWidth={4}
                        colors={[['#fff', 1]]}
                        onComplete={() => {
                            this.runExploring(this.state.algRequested);
                            return [false, 0] // don't repeat animation
                        }}
                        >
                            {({ remainingTime, animatedColor }) => (
                            <Animated.Text style={{ color: animatedColor, fontSize: 35 }}>
                            {remainingTime}
                            </Animated.Text>
                            )}
                        </CountdownCircleTimer>
                    ) : (
                        <Button 
                        title="Ferma Robot" 
                        onPress={() => this.stopExploring(modes[2])} />             
                    )
                ) : (
                    <Button 
                    title="Avvia Navigazione Autonoma" 
                    onPress={() => this.startExploring(modes[2])} />
                )
                }
            </View>
          </Swiper>
        );
    }

    startExploring = (mode) => {
        /*
        * 2. Random Walk (Coverage Algorithms)
        * 3. Boustrophedon (Coverage Algorithms)
        * 4. Spiral (/w Wall follow after first hit) (Coverage Algorithms)
        */
        var algorithm_code = mode[0];
        var algorithm_name = mode[1];
        var viewIndex = algorithm_code - 2;

        // lock
        this.setState({swiperScrollEnabled: false, swiperShowsButtons: false, algRequested: algorithm_code, viewInLoading: viewIndex});        
    }

    runExploring = (algorithm) => {
        // http request
        instance.post("/setmode?op=" + algorithm + "&auth=" + this.state.authcode)
        .then((res) => {
            this.setState({viewInLoading: -1});
        })
        .catch((e) => {
            Alert.alert(
                "Impossibile completare l'operazione", 
                "Verificare la connessione alla rete",
                [{ text: "OK" }], 
                { cancelable: true }
            );
        });
    }

    stopExploring = (mode) => {
        // http request
        instance.post("/setmode?op=-1&auth=" + this.state.authcode)
        .catch(function(e) {
            Alert.alert(
                "Impossibile completare l'operazione", 
                "Verificare la connessione alla rete",
                [{ text: "OK" }], 
                { cancelable: true }
            );
        });

        // unlock
        this.setState({swiperScrollEnabled: true, swiperShowsButtons: true, algRequested: -1});
    }
}

const styles = StyleSheet.create({
    wrapper: {},
    slide1: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      //backgroundColor: '#9DD6EB'
    },
    slide2: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      //backgroundColor: '#97CAE5'
    },
    slide3: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      //backgroundColor: '#92BBD9'
    },
    text: {
      color: '#333',
      fontSize: 30,
      fontWeight: 'bold'
    },
    smalltext: {
        fontSize: 14,
    },
    emoji: {
      fontSize: 100,
    }
  })