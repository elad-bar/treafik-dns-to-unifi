import { createTheme } from "@mui/material/styles";

export function getTheme(mode) {
  return createTheme({
    palette: {
      mode: mode === "dark" ? "dark" : "light",
    },
  });
}
