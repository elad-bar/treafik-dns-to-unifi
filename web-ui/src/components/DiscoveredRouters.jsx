import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  IconButton,
  Typography,
  Alert,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncIcon from "@mui/icons-material/Sync";
import { setSectionError } from "../store/slices/uiSlice";
import { putOverridesConfig } from "../store/slices/configSlice";
import { fetchDiscovered, syncDiscovered } from "../store/slices/discoveredSlice";

function UdmIndicator({ registeredInUdm, enabledInUdm }) {
  const color =
    registeredInUdm === true && enabledInUdm === false
      ? "warning.main"
      : registeredInUdm === true
        ? "success.main"
        : registeredInUdm === false
          ? "error.main"
          : "grey.500";
  const ariaLabel =
    registeredInUdm === true && enabledInUdm === false
      ? "In UDM but disabled"
      : registeredInUdm === true
        ? "In UDM"
        : registeredInUdm === false
          ? "Not in UDM"
          : "Unknown";
  return (
    <Box
      component="span"
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: color,
        display: "inline-block",
        mr: 1,
        verticalAlign: "middle",
      }}
      aria-label={ariaLabel}
    />
  );
}

export default function DiscoveredRouters() {
  const dispatch = useDispatch();
  const config = useSelector((state) => state.config.config);
  const list = useSelector((state) => state.discovered.list);
  const sectionError = useSelector((state) => state.ui.sectionErrors?.overrides);

  const [editingHostname, setEditingHostname] = useState(null);
  const [editorDomain, setEditorDomain] = useState("");
  const [editorIp, setEditorIp] = useState("");

  const currentOverrides = config?.dnsOverrides || {};
  const targetIp = config?.targetIp || "";
  const isEditMode = editingHostname !== null;
  const traefikReady = config?.traefikReady === true;
  const udmReady = config?.udmReady === true;

  useEffect(() => {
    if (!editingHostname && targetIp && editorIp === "") {
      setEditorIp(targetIp);
    }
  }, [targetIp, editingHostname, editorIp]);

  const listSet = new Set(list.map((r) => r.hostname));
  const overrideOnly = Object.keys(currentOverrides).filter((k) => !listSet.has(k));
  const rows = [
    ...list.map((r) => ({
      ...r,
      ipDisplay: currentOverrides[r.hostname] != null ? currentOverrides[r.hostname] : r.ip,
    })),
    ...overrideOnly.map((hostname) => ({
      hostname,
      ip: currentOverrides[hostname] || targetIp,
      ipDisplay: currentOverrides[hostname] || targetIp,
      registeredInUdm: list.length && list[0].registeredInUdm === null ? null : false,
      enabledInUdm: undefined,
    })),
  ].sort((a, b) => a.hostname.localeCompare(b.hostname));

  const switchToAddMode = () => {
    dispatch(setSectionError({ section: "overrides", message: null }));
    setEditingHostname(null);
    setEditorDomain("");
    setEditorIp(targetIp);
  };

  const openEdit = (row) => {
    dispatch(setSectionError({ section: "overrides", message: null }));
    setEditingHostname(row.hostname);
    setEditorDomain(row.hostname);
    setEditorIp(currentOverrides[row.hostname] != null ? currentOverrides[row.hostname] : row.ip);
  };

  const handleSave = async () => {
    const domain = editorDomain.trim().toLowerCase();
    const ip = (editorIp || "").trim();
    if (!domain || !ip) {
      dispatch(setSectionError({ section: "overrides", message: "Domain and IP are required." }));
      return;
    }
    dispatch(setSectionError({ section: "overrides", message: null }));
    const next = { ...currentOverrides, [domain]: ip };
    const result = await dispatch(putOverridesConfig({ dnsOverrides: next }));
    if (putOverridesConfig.fulfilled.match(result)) {
      switchToAddMode();
      dispatch(fetchDiscovered());
    } else {
      dispatch(setSectionError({ section: "overrides", message: result.error?.message || result.payload || "Save failed" }));
    }
  };

  const handleReset = async (row) => {
    const next = { ...currentOverrides };
    delete next[row.hostname];
    const result = await dispatch(putOverridesConfig({ dnsOverrides: next }));
    if (putOverridesConfig.fulfilled.match(result)) {
      if (editingHostname === row.hostname) {
        switchToAddMode();
      }
      dispatch(fetchDiscovered());
    } else {
      dispatch(setSectionError({ section: "overrides", message: result.error?.message || result.payload || "Reset failed" }));
    }
  };

  const handleRefresh = () => dispatch(fetchDiscovered());
  const handleSync = () => dispatch(syncDiscovered());

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        gap: 2,
        mt: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ flex: "2 1 0", minWidth: 280, display: "flex" }}>
        <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Discovered routers"
            action={
              <Box sx={{ display: "flex", gap: 0 }}>
                <Tooltip title="Refetch list">
                  <IconButton
                    onClick={handleRefresh}
                    disabled={!traefikReady}
                    aria-label="Refetch discovered routers"
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sync Traefik to UDM">
                  <IconButton
                    onClick={handleSync}
                    disabled={!traefikReady || !udmReady}
                    aria-label="Sync to UDM"
                  >
                    <SyncIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          />
          <CardContent sx={{ flex: 1 }}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Domain</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell align="right" width={96} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.hostname}>
                      <TableCell>
                        <UdmIndicator
                          registeredInUdm={row.registeredInUdm}
                          enabledInUdm={row.enabledInUdm}
                        />
                        {row.hostname}
                      </TableCell>
                      <TableCell>{row.ipDisplay}</TableCell>
                      <TableCell align="right">
                        {currentOverrides[row.hostname] != null && (
                          <Tooltip title="Reset">
                            <IconButton
                              size="small"
                              onClick={() => handleReset(row)}
                              aria-label={`reset ${row.hostname}`}
                            >
                              <RestoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEdit(row)}
                            aria-label={`edit ${row.hostname}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ flex: "1 1 0", minWidth: 280, display: "flex" }}>
        <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <CardHeader
            title="Override Router"
            action={
              <Box sx={{ display: "flex", gap: 0 }}>
                <Tooltip title="Save">
                  <IconButton onClick={handleSave} aria-label="save">
                    <SaveIcon />
                  </IconButton>
                </Tooltip>
                {isEditMode && (
                  <Tooltip title="Cancel">
                    <IconButton onClick={switchToAddMode} aria-label="cancel">
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            }
          />
          <CardContent sx={{ flex: 1 }}>
            {sectionError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => dispatch(setSectionError({ section: "overrides", message: null }))}
              >
                {sectionError}
              </Alert>
            )}
            <TextField
              label="Domain"
              value={editorDomain}
              onChange={(e) => setEditorDomain(e.target.value)}
              placeholder="example.com"
              fullWidth
              disabled={isEditMode}
              sx={{ mb: 2 }}
            />
            <TextField
              label="IP"
              value={editorIp}
              onChange={(e) => setEditorIp(e.target.value)}
              placeholder={targetIp}
              fullWidth
            />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
