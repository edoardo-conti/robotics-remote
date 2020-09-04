import React, { Component } from "react";
import {
  StyleSheet,
  Text,
  View,
  Alert,
  Animated,
  Image,
  Platform,
  TouchableOpacity,
} from "react-native";
import { CountdownCircleTimer } from "react-native-countdown-circle-timer";
import Swiper from "react-native-swiper";
import axios from "axios";

import { FontAwesome5 } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

const instance = axios.create({
  //baseURL: "http://10.0.0.116/api",
  baseURL: "http://arduino-wifi-robot-0df8/api",
  timeout: 3000,
});
const modes = [
  [2, "Random Walk"],
  [3, "Boustrophedon"],
  [4, "Spiral Wall-Follow"],
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

  handleSlideChange = (index) => {
    if (Platform.OS != "android") {
      switch (index) {
        case 0:
          this.animation0.play();
          break;
        case 1:
          this.animation1.play();
          break;
        case 2:
          this.animation2.play();
          break;
      }
    }
  };

  render() {
    return (
      <Swiper
        style={styles.wrapper}
        showsButtons={this.state.swiperShowsButtons}
        scrollEnabled={this.state.swiperScrollEnabled}
        loop={false}
        onIndexChanged={this.handleSlideChange}
      >
        <View style={styles.slide1}>
          {Platform.OS == "android" ? (
            <Image
              style={[styles.algsSlideImage]}
              source={require("../assets/images/random_walk.png")}
              resizeMode="cover"
            ></Image>
          ) : (
            <LottieView
              source={require("../assets/animations/random_walk.json")}
              autoPlay
              loop={false}
              style={styles.algsSlideAnimation}
              resizeMode="cover"
              ref={(animation0) => {
                this.animation0 = animation0;
              }}
            />
          )}

          <View style={styles.viewCard}>
            <View style={styles.viewCardIconContainer}>
              <FontAwesome5
                name="random"
                size={30}
                color="#6b4eff"
                style={styles.viewCardIcon}
              />
            </View>
            <Text style={styles.viewCardTitle}>Random Walk</Text>
            <Text style={styles.viewCardDesc}>
            Algoritmo che non prevede la pianificazione di un percorso bensì si fonda su un serie di scelte del tutto randomiche e non frutto di una qualsiasi analisi della situazione corrente.
            </Text>
            <View style={styles.viewCardButtons}>
              {this.state.algRequested == 2 ? (
                this.state.viewInLoading == 0 ? (
                  <CountdownCircleTimer
                    isPlaying
                    duration={3}
                    size={100}
                    strokeWidth={4}
                    colors={[["#515a83", 1]]}
                    onComplete={() => {
                      this.runExploring(this.state.algRequested);
                      return [false, 0]; // don't repeat animation
                    }}
                  >
                    {({ remainingTime, animatedColor }) => (
                      <Animated.Text
                        style={{ color: animatedColor, fontSize: 35 }}
                      >
                        {remainingTime}
                      </Animated.Text>
                    )}
                  </CountdownCircleTimer>
                ) : (
                  <TouchableOpacity
                    style={[styles.viewCardButton, styles.viewCardButtonStop]}
                    onPress={() => this.stopExploring(modes[0])}
                  >
                    <Text
                      style={[
                        styles.viewCardButtonText,
                        styles.viewCardButtonTextStop,
                      ]}
                    >
                      Ferma Robot
                    </Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity
                  style={[styles.viewCardButton, styles.viewCardButtonStart]}
                  onPress={() => this.startExploring(modes[0])}
                >
                  <Text
                    style={[
                      styles.viewCardButtonText,
                      styles.viewCardButtonTextStart,
                    ]}
                  >
                    Avvia Navigazione Autonoma
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={styles.slide2}>
          {Platform.OS == "android" ? (
            <Image
              style={[styles.algsSlideImage]}
              source={require("../assets/images/boustrophedon.png")}
              resizeMode="cover"
            />
          ) : (
            <LottieView
              source={require("../assets/animations/boustrophedon.json")}
              //autoPlay
              loop={false}
              style={styles.algsSlideAnimation}
              resizeMode="cover"
              ref={(animation1) => {
                this.animation1 = animation1;
              }}
            />
          )}

          <View style={styles.viewCard}>
            <View style={styles.viewCardIconContainer}>
              <MaterialCommunityIcons
                name="wall"
                size={30}
                color="#6b4eff"
                style={styles.viewCardIcon}
              />
            </View>
            <Text style={styles.viewCardTitle}>Boustrophedon</Text>
            <Text style={styles.viewCardDesc}>
            Questo approccio si serve di una struttura geometrica chiamata decomposizione cellulare esatta (dall'inglese "exact cellular decomposition") definita come l'unione di regioni non intersecanti che compongono l'ambiente circostante.
            </Text>
            <View style={styles.viewCardButtons}>
              {this.state.algRequested == 3 ? (
                this.state.viewInLoading == 1 ? (
                  <CountdownCircleTimer
                    isPlaying
                    duration={3}
                    size={100}
                    strokeWidth={4}
                    colors={[["#515a83", 1]]}
                    onComplete={() => {
                      this.runExploring(this.state.algRequested);
                      return [false, 0]; // don't repeat animation
                    }}
                  >
                    {({ remainingTime, animatedColor }) => (
                      <Animated.Text
                        style={{ color: animatedColor, fontSize: 35 }}
                      >
                        {remainingTime}
                      </Animated.Text>
                    )}
                  </CountdownCircleTimer>
                ) : (
                  <TouchableOpacity
                    style={[styles.viewCardButton, styles.viewCardButtonStop]}
                    onPress={() => this.stopExploring(modes[1])}
                  >
                    <Text
                      style={[
                        styles.viewCardButtonText,
                        styles.viewCardButtonTextStop,
                      ]}
                    >
                      Ferma Robot
                    </Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity
                  style={[styles.viewCardButton, styles.viewCardButtonStart]}
                  onPress={() => this.startExploring(modes[1])}
                >
                  <Text
                    style={[
                      styles.viewCardButtonText,
                      styles.viewCardButtonTextStart,
                    ]}
                  >
                    Avvia Navigazione Autonoma
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.slide3}>
          {Platform.OS == "android" ? (
            <Image
              style={[styles.algsSlideImage]}
              source={require("../assets/images/spiral.png")}
              resizeMode="cover"
            />
          ) : (
            <LottieView
              source={require("../assets/animations/spiral.json")}
              //autoPlay
              loop={false}
              style={styles.algsSlideAnimation}
              resizeMode="cover"
              ref={(animation2) => {
                this.animation2 = animation2;
              }}
            />
          )}

          <View style={styles.viewCard}>
            <View style={styles.viewCardIconContainer}>
              <MaterialCommunityIcons
                name="selection-ellipse-arrow-inside"
                size={30}
                color="#6b4eff"
                style={styles.viewCardIcon}
              />
            </View>
            <Text style={styles.viewCardTitle}>
              Spiral <Text style={styles.viewCardSubTitle}>(/w Wall-Follow)</Text>
            </Text>
            <Text style={styles.viewCardDesc}>
            Un algoritmo a spirale combina l'uso di traiettorie a spirale e sterzate randomiche. Il criterio operativo si rifà agli algoritmi Random Walk con la sostanziale differenza che il robot inizia il processo dapprima seguendo un percorso a spirale.
            </Text>
            <View style={styles.viewCardButtons}>
              {this.state.algRequested == 4 ? (
                this.state.viewInLoading == 2 ? (
                  <CountdownCircleTimer
                    isPlaying
                    duration={3}
                    size={100}
                    strokeWidth={4}
                    colors={[["#515a83", 1]]}
                    onComplete={() => {
                      this.runExploring(this.state.algRequested);
                      return [false, 0]; // don't repeat animation
                    }}
                  >
                    {({ remainingTime, animatedColor }) => (
                      <Animated.Text
                        style={{ color: animatedColor, fontSize: 35 }}
                      >
                        {remainingTime}
                      </Animated.Text>
                    )}
                  </CountdownCircleTimer>
                ) : (
                  <TouchableOpacity
                    style={[styles.viewCardButton, styles.viewCardButtonStop]}
                    onPress={() => this.stopExploring(modes[2])}
                  >
                    <Text
                      style={[
                        styles.viewCardButtonText,
                        styles.viewCardButtonTextStop,
                      ]}
                    >
                      Ferma Robot
                    </Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity
                  style={[styles.viewCardButton, styles.viewCardButtonStart]}
                  onPress={() => this.startExploring(modes[2])}
                >
                  <Text
                    style={[
                      styles.viewCardButtonText,
                      styles.viewCardButtonTextStart,
                    ]}
                  >
                    Avvia Navigazione Autonoma
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
    this.setState({
      swiperScrollEnabled: false,
      swiperShowsButtons: false,
      algRequested: algorithm_code,
      viewInLoading: viewIndex,
    });
  };

  runExploring = (algorithm) => {
    // http request
    instance
      .post("/setmode?op=" + algorithm + "&auth=" + this.state.authcode)
      .then((res) => {
        this.setState({ viewInLoading: -1 });
      })
      .catch((e) => {
        Alert.alert(
          "Impossibile completare l'operazione",
          "Verificare la connessione alla rete",
          [{ text: "OK" }],
          { cancelable: true }
        );
      });
  };

  stopExploring = (mode) => {
    // http request
    instance
      .post("/setmode?op=-1&auth=" + this.state.authcode)
      .catch(function (e) {
        Alert.alert(
          "Impossibile completare l'operazione",
          "Verificare la connessione alla rete",
          [{ text: "OK" }],
          { cancelable: true }
        );
      });

    // unlock
    this.setState({
      swiperScrollEnabled: true,
      swiperShowsButtons: true,
      algRequested: -1,
    });
  };
}

function Separator() {
  return <View style={styles.separator}></View>;
}

const platformFont = Platform.OS === "android" ? "Roboto" : "Helvetica Neue";
const styles = StyleSheet.create({
  wrapper: {},
  separator: {
    marginVertical: 8,
    borderBottomColor: "#737373",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slide1: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#c1dbff",
  },
  slide2: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff643b",
  },
  slide3: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#515a83",
  },
  algsSlideImage: {
    flex: 1,
    position: "absolute",
  },
  viewCard: {
    width: "80%",
    height: 320,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 4,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewCardIconContainer: {
    alignItems: "flex-end",
    backgroundColor: "#eaedff",
    width: 64,
    height: 64,
    padding: 10,
    position: "absolute",
    right: 0,
    borderBottomLeftRadius: 60,
    borderTopRightRadius: 10,
  },
  viewCardTitle: {
    //flex: 1,
    color: "#012e63",
    fontFamily: platformFont,
    fontSize: 30,
    fontWeight: "bold",
    //backgroundColor: "red", //debug
    marginBottom: 15,
  },
  viewCardSubTitle: {
    fontSize: 15,
  },
  viewCardDesc: {
    flex: 1,
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    color: "#557e9e",
    fontFamily: platformFont,
    fontSize: 15,
    //backgroundColor: "green", //debug
  },
  viewCardButtons: {
    height: 100,
    justifyContent: "flex-end",
    alignItems: "center",
    //backgroundColor: "yellow", //debug
  },
  viewCardButton: {
    padding: 14,
    alignSelf: "stretch",
    borderRadius: 12,
    alignItems: "center",
  },
  viewCardButtonStart: {
    backgroundColor: "#ff6535",
  },
  viewCardButtonStop: {
    backgroundColor: "#dddddd",
  },
  viewCardButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  viewCardButtonTextStart: {
    color: "#fff",
  },
});
