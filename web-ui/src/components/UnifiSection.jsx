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
import { putUnifiConfig } from "../store/slices/configSlice";
import { fetchDiscovered } from "../store/slices/discoveredSlice";

const SECTION = "unifi";

export default function UnifiSection() {
  const dispatch = useDispatch();
  const config = useSelector((state) => state.config.config);
  const editingSection = useSelector((state) => state.ui.editingSection);
  const sectionFormValues = useSelector((state) => state.ui.sectionFormValues);
  const sectionError = useSelector((state) => state.ui.sectionErrors?.unifi);

  const isEditing = editingSection === SECTION;
  const values = isEditing ? sectionFormValues : (config || {});

  const handleEdit = () => {
    dispatch(
      openEdit({
        section: SECTION,
        initialValues: {
          udmUrl: config?.udmUrl ?? "",
          udmApiKey: config?.udmApiKey ?? "",
        },
      })
    );
  };

  const handleCancel = () => {
    dispatch(closeEdit());
  };

  const handleSave = async () => {
    dispatch(setSectionError({ section: "unifi", message: null }));
    const result = await dispatch(
      putUnifiConfig({
        udmUrl: sectionFormValues.udmUrl ?? config?.udmUrl ?? "",
        udmApiKey: sectionFormValues.udmApiKey !== undefined ? sectionFormValues.udmApiKey : config?.udmApiKey ?? "",
      })
    );
    if (putUnifiConfig.fulfilled.match(result)) {
      dispatch(closeEdit());
      dispatch(fetchDiscovered());
    } else {
      dispatch(setSectionError({ section: "unifi", message: result.error?.message || result.payload || "Save failed" }));
    }
  };

  return (
    <Card sx={{ mb: 2, flex: 1, display: "flex", flexDirection: "column" }}>
      <CardHeader
        title="Unifi"
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
            <IconButton onClick={handleEdit} aria-label="edit Unifi">
              <EditIcon />
            </IconButton>
          )
        }
      />
      <CardContent sx={{ flex: 1 }}>
        {sectionError && isEditing && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setSectionError({ section: "unifi", message: null }))}>
            {sectionError}
          </Alert>
        )}
        {isEditing ? (
          <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="URL"
              value={values.udmUrl ?? ""}
              onChange={(e) =>
                dispatch(setSectionFormValues({ udmUrl: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="API Key"
              type="password"
              value={values.udmApiKey ?? ""}
              onChange={(e) =>
                dispatch(setSectionFormValues({ udmApiKey: e.target.value }))
              }
              fullWidth
            />
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary">
              URL: {config?.udmUrl || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              API Key: {config?.udmApiKey ? "***" : "—"}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
