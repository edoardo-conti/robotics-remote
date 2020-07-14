import React from "react";
import Constants from "expo-constants";
import { Button, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import SyntaxHighlighter from 'react-native-syntax-highlighter';

import { HomeScreen, BlocklyScreen, getCodeBlockly, runCodeBlockly } from "./Helper";

//const Stack = createStackNavigator();

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
      //style={docco}
      //highlighter={"prism" || "hljs"}
      highlighter='hljs'
      >
      {code}
      </SyntaxHighlighter>
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