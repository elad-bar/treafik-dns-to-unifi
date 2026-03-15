import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getDiscovered } from "../../api/client";

export const fetchDiscovered = createAsyncThunk(
  "discovered/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await getDiscovered();
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

const discoveredSlice = createSlice({
  name: "discovered",
  initialState: {
    list: [],
    loadError: null,
  },
  reducers: {
    setList: (state, action) => {
      state.list = action.payload;
      state.loadError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscovered.fulfilled, (state, action) => {
        state.list = action.payload;
        state.loadError = null;
      })
      .addCase(fetchDiscovered.rejected, (state, action) => {
        state.loadError = action.payload || "Failed to load discovered";
      });
  },
});

export const { setList } = discoveredSlice.actions;
export default discoveredSlice.reducer;
