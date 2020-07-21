import React from "react";
import { Button } from "react-native";
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { LinearGradient } from "expo-linear-gradient";

import { createNativeStackNavigator } from 'react-native-screens/native-stack';

import { HomeScreen, BlocklyScreen, areaCoverageScreen } from "./Helper";
import { getCode } from "./BlocklyPage";

import { BlurView } from 'expo-blur';

enableScreens();

//const Stack = createStackNavigator();
const Stack = createNativeStackNavigator();

export default (App) => {
  return (
    <NavigationContainer>
      <Stack.Navigator 
      initialRouteName="Home"
      screenOptions={{
        headerLargeTitle: true,
        headerHideShadow: true,
        //headerStyle: {backgroundColor: "#ffab24"},
        //headerTintColor: "white"
      }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ 
            title: "Dashboard",
            headerTransparent: true,
            headerBackground: () => (
              <BlurView
                tint="dark"
                intensity={100}
                style={StyleSheet.absoluteFill}
              />
            ),
          }}
        />
        <Stack.Screen 
          name="Blockly" 
          component={BlocklyScreen} 
          options={{
            headerRight: () => (
              <Button
                onPress={getCode}
                title="Codice"
              />
            ),
          }}
        />
        <Stack.Screen
          name="areaCoverageScreen"
          component={areaCoverageScreen}
          options={{ title: "Area Coverage Algorithms" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/*
const MainStack = createStackNavigator();
const RootStack = createStackNavigator();

function MainStackScreen() {
  return (
    <MainStack.Navigator initialRouteName="Home">
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <MainStack.Screen 
        name="Blockly" 
        component={BlocklyScreen} 
        options={{
          headerRight: () => (
            <Button
              //onPress={() => alert('This is a button!')}
              onPress={getCodeBlockly}
              title="Get Code"
            />
          ),
        }}
      />
      <MainStack.Screen
        name="areaCoverageScreen"
        component={areaCoverageScreen}
        options={{ title: "Area Coverage Algorithms" }}
      />
    </MainStack.Navigator>
  );
}

function ModalScreen({ route, navigation }) {
  const { code } = route.params;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Constants.statusBarHeight + 10, paddingBottom: Constants.statusBarHeight}}>
      <SyntaxHighlighter 
      language='javascript' 
      //fontSize={16}
      style={docco}
      //highlighter={"prism" || "hljs"}
      highlighter='hljs'
      >
      {code}
      </SyntaxHighlighter>
      <Button onPress={runCodeBlockly} title="Esegui Codice" />
      <Button onPress={() => navigation.goBack()} title="Chiudi" />
    </View>
  );
}

export default (App) => {
  return (
    <NavigationContainer>
      <RootStack.Navigator mode="modal" headerMode="none">
        <RootStack.Screen name="Main" component={MainStackScreen} />
        <RootStack.Screen name="MyModal" component={ModalScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
*/

/*
export default (App) => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Home" }}
        />
        <Stack.Screen 
          name="Blockly" 
          component={BlocklyScreen} 
          options={{ }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
*/