import { configureStore } from "@reduxjs/toolkit";
import configReducer from "./slices/configSlice";
import discoveredReducer from "./slices/discoveredSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    config: configReducer,
    discovered: discoveredReducer,
    ui: uiReducer,
  },
});
