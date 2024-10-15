import React, { useMemo } from "react";
import { locations } from "@contentful/app-sdk";
import ConfigScreen from "@/components/locations/ConfigScreen";
import EntryEditor from "@/components/locations/EntryEditor";
import Sidebar from "@/components/locations/Sidebar";
import { useSDK } from "@contentful/react-apps-toolkit";
import { GrowthbookAPIProvider } from "contexts/GrowthbookAPIContext";
import { ContentTypesProvider } from "contexts/ContentTypesContext";

const ComponentLocationSettings = {
  [locations.LOCATION_APP_CONFIG]: <ConfigScreen />,
  [locations.LOCATION_ENTRY_EDITOR]: (
    <GrowthbookAPIProvider>
      <ContentTypesProvider>
        <EntryEditor />
      </ContentTypesProvider>
    </GrowthbookAPIProvider>
  ),
  [locations.LOCATION_ENTRY_SIDEBAR]: (
    <GrowthbookAPIProvider>
      <Sidebar />
    </GrowthbookAPIProvider>
  ),
};

const App = () => {
  const sdk = useSDK();

  const Component = useMemo(() => {
    for (const [location, component] of Object.entries(
      ComponentLocationSettings
    )) {
      if (sdk.location.is(location)) {
        return component;
      }
    }
  }, [sdk.location]);

  return Component ? Component : null;
};

export default App;
