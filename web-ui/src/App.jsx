import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ThemeProvider, CssBaseline, Container, Box } from "@mui/material";
import { getTheme } from "./theme";
import AppBar from "./components/AppBar";
import UnifiSection from "./components/UnifiSection";
import TraefikSection from "./components/TraefikSection";
import SystemSection from "./components/SystemSection";
import DiscoveredRouters from "./components/DiscoveredRouters";
import { fetchConfig } from "./store/slices/configSlice";
import { fetchDiscovered } from "./store/slices/discoveredSlice";

export default function App() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.ui.themeMode);
  const theme = getTheme(themeMode);

  useEffect(() => {
    dispatch(fetchConfig());
    dispatch(fetchDiscovered());
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <AppBar />
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 2,
              mb: 2,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ flex: "1 1 0", minWidth: 280, display: "flex" }}>
              <UnifiSection />
            </Box>
            <Box sx={{ flex: "1 1 0", minWidth: 280, display: "flex" }}>
              <TraefikSection />
            </Box>
            <Box sx={{ flex: "1 1 0", minWidth: 280, display: "flex" }}>
              <SystemSection />
            </Box>
          </Box>
          <DiscoveredRouters />
        </Container>
      </Box>
    </ThemeProvider>
  );
}
