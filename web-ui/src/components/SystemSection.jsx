import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  TextField,
  Box,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import {
  openEdit,
  closeEdit,
  setSectionFormValues,
} from "../store/slices/uiSlice";
import { putSystemConfig } from "../store/slices/configSlice";

const SECTION = "system";
const LOG_LEVELS = ["error", "warn", "info", "debug"];

export default function SystemSection() {
  const dispatch = useDispatch();
  const config = useSelector((state) => state.config.config);
  const editingSection = useSelector((state) => state.ui.editingSection);
  const sectionFormValues = useSelector((state) => state.ui.sectionFormValues);

  const isEditing = editingSection === SECTION;
  const values = isEditing ? sectionFormValues : (config || {});

  const handleEdit = () => {
    dispatch(
      openEdit({
        section: SECTION,
        initialValues: {
          syncIntervalMinutes: config?.syncIntervalMinutes ?? 15,
          insecureTls: config?.insecureTls ?? false,
          logLevel: config?.logLevel ?? "info",
          dryRun: config?.dryRun !== false,
        },
      })
    );
  };

  const handleCancel = () => {
    dispatch(closeEdit());
  };

  const handleSave = async () => {
    const result = await dispatch(
      putSystemConfig({
        syncIntervalMinutes: sectionFormValues.syncIntervalMinutes ?? config?.syncIntervalMinutes ?? 15,
        insecureTls: sectionFormValues.insecureTls ?? config?.insecureTls ?? false,
        logLevel: sectionFormValues.logLevel ?? config?.logLevel ?? "info",
        dryRun: sectionFormValues.dryRun !== false,
      })
    );
    if (putSystemConfig.fulfilled.match(result)) {
      dispatch(closeEdit());
    }
  };

  const syncInterval = values.syncIntervalMinutes ?? 15;
  const active = !(values.dryRun !== false);

  return (
    <Card sx={{ mb: 2, flex: 1, display: "flex", flexDirection: "column" }}>
      <CardHeader
        title="System"
        action={
          isEditing ? (
            <Box sx={{ display: "flex", gap: 0 }}>
              <Tooltip title="Save">
                <IconButton onClick={handleSave} aria-label="save">
                  <SaveIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton onClick={handleCancel} aria-label="cancel">
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <IconButton onClick={handleEdit} aria-label="edit System">
              <EditIcon />
            </IconButton>
          )
        }
      />
      <CardContent sx={{ flex: 1 }}>
        {isEditing ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Sync interval (minutes)"
              type="number"
              inputProps={{ min: 1, max: 60 }}
              value={syncInterval}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n))
                  dispatch(setSectionFormValues({ syncIntervalMinutes: Math.max(1, Math.min(60, n)) }));
              }}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.insecureTls === true}
                  onChange={(e) =>
                    dispatch(setSectionFormValues({ insecureTls: e.target.checked }))
                  }
                />
              }
              label="Allow self-signed TLS certs"
            />
            <FormControl fullWidth>
              <InputLabel>Log level</InputLabel>
              <Select
                value={values.logLevel ?? "info"}
                label="Log level"
                onChange={(e) =>
                  dispatch(setSectionFormValues({ logLevel: e.target.value }))
                }
              >
                {LOG_LEVELS.map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={active}
                  onChange={(e) =>
                    dispatch(setSectionFormValues({ dryRun: !e.target.checked }))
                  }
                />
              }
              label="Active"
            />
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Sync interval: {config?.syncIntervalMinutes ?? 15} min
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Allow self-signed TLS: {config?.insecureTls ? "Yes" : "No"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Log level: {config?.logLevel ?? "info"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active: {config?.dryRun === false ? "Yes" : "No"}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
