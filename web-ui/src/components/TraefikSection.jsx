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
  Alert,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import {
  openEdit,
  closeEdit,
  setSectionFormValues,
  setSectionError,
} from "../store/slices/uiSlice";
import { putTraefikConfig } from "../store/slices/configSlice";
import { fetchDiscovered } from "../store/slices/discoveredSlice";

const SECTION = "traefik";

export default function TraefikSection() {
  const dispatch = useDispatch();
  const config = useSelector((state) => state.config.config);
  const editingSection = useSelector((state) => state.ui.editingSection);
  const sectionFormValues = useSelector((state) => state.ui.sectionFormValues);
  const sectionError = useSelector((state) => state.ui.sectionErrors?.traefik);

  const isEditing = editingSection === SECTION;
  const values = isEditing ? sectionFormValues : (config || {});

  const handleEdit = () => {
    dispatch(
      openEdit({
        section: SECTION,
        initialValues: {
          traefikBaseUrl: config?.traefikBaseUrl ?? "",
          managedDomain: config?.managedDomain ?? "",
          targetIp: config?.targetIp ?? "",
        },
      })
    );
  };

  const handleCancel = () => {
    dispatch(closeEdit());
  };

  const handleSave = async () => {
    dispatch(setSectionError({ section: "traefik", message: null }));
    const result = await dispatch(
      putTraefikConfig({
        traefikBaseUrl: sectionFormValues.traefikBaseUrl ?? config?.traefikBaseUrl ?? "",
        managedDomain: sectionFormValues.managedDomain !== undefined ? sectionFormValues.managedDomain : config?.managedDomain ?? "",
        targetIp: sectionFormValues.targetIp ?? config?.targetIp ?? "",
      })
    );
    if (putTraefikConfig.fulfilled.match(result)) {
      dispatch(closeEdit());
      dispatch(fetchDiscovered());
    } else {
      dispatch(setSectionError({ section: "traefik", message: result.error?.message || result.payload || "Save failed" }));
    }
  };

  return (
    <Card sx={{ mb: 2, flex: 1, display: "flex", flexDirection: "column" }}>
      <CardHeader
        title="Traefik"
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
            <IconButton onClick={handleEdit} aria-label="edit Traefik">
              <EditIcon />
            </IconButton>
          )
        }
      />
      <CardContent sx={{ flex: 1 }}>
        {sectionError && isEditing && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setSectionError({ section: "traefik", message: null }))}>
            {sectionError}
          </Alert>
        )}
        {isEditing ? (
          <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="URL"
              value={values.traefikBaseUrl ?? ""}
              onChange={(e) =>
                dispatch(setSectionFormValues({ traefikBaseUrl: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Managed domain"
              value={values.managedDomain ?? ""}
              onChange={(e) =>
                dispatch(setSectionFormValues({ managedDomain: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Target IP"
              value={values.targetIp ?? ""}
              onChange={(e) =>
                dispatch(setSectionFormValues({ targetIp: e.target.value }))
              }
              fullWidth
            />
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary">
              URL: {config?.traefikBaseUrl || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Managed domain: {config?.managedDomain || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Target IP: {config?.targetIp || "—"}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
