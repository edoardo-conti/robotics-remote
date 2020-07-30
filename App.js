import React from "react";
import {Platform } from "react-native";
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from "@react-navigation/native";
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