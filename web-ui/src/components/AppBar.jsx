import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { setThemeMode } from "../store/slices/uiSlice";

export default function AppBar() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.ui.themeMode);
  const theme = useTheme();

  const toggleTheme = () => {
    dispatch(setThemeMode(themeMode === "light" ? "dark" : "light"));
  };

  return (
    <MuiAppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Traefik DNS → Unifi
        </Typography>
        <IconButton color="inherit" onClick={toggleTheme} aria-label="toggle theme">
          {theme.palette.mode === "dark" ? (
            <LightModeIcon />
          ) : (
            <DarkModeIcon />
          )}
        </IconButton>
      </Toolbar>
    </MuiAppBar>
  );
}
