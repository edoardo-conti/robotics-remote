import React, { useEffect, useState } from "react";
import { Button, Platform, DynamicColorIOS } from "react-native";
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from 'react-native-screens/native-stack';

import { OverflowMenuProvider } from 'react-navigation-header-buttons';
import {
  HeaderButtons,
  HeaderButton,
  Item,
  OverflowMenu,
  HiddenItem,
} from 'react-navigation-header-buttons';

import { HomeScreen, BlocklyScreen, areaCoverageScreen } from "./Helper";
import { getCode, refreshWebView, clearBlocklyWorkspace } from "./BlocklyPage";

import { BlurView } from 'expo-blur';

enableScreens();

//const Stack = createStackNavigator();
const Stack = createNativeStackNavigator();

const IoniconsHeaderButton = (props) => (
  // the `props` here come from <Item ... />
  // you may access them and pass something else to `HeaderButton` if you like
  <HeaderButton {...props} IconComponent={Ionicons} iconSize={23} color="midnightblue" />
);

export default (App) => {
  return (
    <NavigationContainer>
      <OverflowMenuProvider>
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
              <HeaderButtons HeaderButtonComponent={IoniconsHeaderButton}>
              <Item title="build" iconName={Platform.OS == 'android' ? "md-build" : "ios-build"} onPress={getCode} />
              <OverflowMenu
                style={{ 
                  marginHorizontal: 10, 
                  //marginRight: -5, 
                }}
                OverflowIcon={<Ionicons name={Platform.OS == 'android' ? "md-more" : "ios-more"} size={23} color="midnightblue" />}
              >
                <HiddenItem title="Aggiorna" onPress={refreshWebView} />
                <HiddenItem title="Pulisci workspace" onPress={clearBlocklyWorkspace}/>
              </OverflowMenu>
              </HeaderButtons>
            ),
          }}
          /*options={{
            headerRight: () => (
              <Button
                onPress={getCode}
                title="Codice"
              />
            ),
          }}*/
        />
        <Stack.Screen
          name="areaCoverageScreen"
          component={areaCoverageScreen}
          options={{ title: "Area Coverage Algorithms" }}
        />
      </Stack.Navigator>
      </OverflowMenuProvider>
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