import { createSlice } from "@reduxjs/toolkit";

const loadTheme = () => {
  try {
    const s = localStorage.getItem("themeMode");
    return s === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    editingSection: null,
    sectionFormValues: {},
    sectionErrors: {},
    themeMode: loadTheme(),
  },
  reducers: {
    openEdit: (state, action) => {
      state.editingSection = action.payload.section;
      state.sectionFormValues = action.payload.initialValues || {};
      state.sectionErrors[action.payload.section] = null;
    },
    closeEdit: (state) => {
      state.editingSection = null;
      state.sectionFormValues = {};
      state.sectionErrors = {};
    },
    setSectionFormValues: (state, action) => {
      state.sectionFormValues = { ...state.sectionFormValues, ...action.payload };
    },
    setSectionError: (state, action) => {
      const { section, message } = action.payload;
      state.sectionErrors[section] = message;
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
      try {
        localStorage.setItem("themeMode", action.payload);
      } catch (_) {}
    },
  },
});

export const {
  openEdit,
  closeEdit,
  setSectionFormValues,
  setSectionError,
  setThemeMode,
} = uiSlice.actions;
export default uiSlice.reducer;
