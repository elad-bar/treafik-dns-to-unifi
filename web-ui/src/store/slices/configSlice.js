import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getConfig,
  putConfigUnifi,
  putConfigTraefik,
  putConfigSystem,
  putConfigOverrides,
} from "../../api/client";

export const fetchConfig = createAsyncThunk(
  "config/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await getConfig();
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

export const putUnifiConfig = createAsyncThunk(
  "config/putUnifi",
  async (body, { rejectWithValue }) => {
    try {
      return await putConfigUnifi(body);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

export const putTraefikConfig = createAsyncThunk(
  "config/putTraefik",
  async (body, { rejectWithValue }) => {
    try {
      return await putConfigTraefik(body);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

export const putSystemConfig = createAsyncThunk(
  "config/putSystem",
  async (body, { rejectWithValue }) => {
    try {
      return await putConfigSystem(body);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

export const putOverridesConfig = createAsyncThunk(
  "config/putOverrides",
  async (body, { rejectWithValue }) => {
    try {
      return await putConfigOverrides(body);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

const configSlice = createSlice({
  name: "config",
  initialState: {
    config: null,
    loadError: null,
  },
  reducers: {
    setLoadError: (state, action) => {
      state.loadError = action.payload;
    },
    updateConfig: (state, action) => {
      state.config = action.payload;
      state.loadError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadError = null;
      })
      .addCase(fetchConfig.rejected, (state, action) => {
        state.loadError = action.payload || "Failed to load config";
      })
      .addCase(putUnifiConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadError = null;
      })
      .addCase(putTraefikConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadError = null;
      })
      .addCase(putSystemConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadError = null;
      })
      .addCase(putOverridesConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadError = null;
      });
  },
});

export const { setLoadError, updateConfig } = configSlice.actions;
export default configSlice.reducer;
