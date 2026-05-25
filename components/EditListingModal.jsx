import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

const EditListingModal = ({ visible, listing, onClose, onSave }) => {
  // initialize from prop so the modal can render immediately when opened
  const [form, setForm] = useState(() => (listing ? { ...listing } : null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (listing) setForm({ ...listing });
    else setForm(null);
  }, [listing]);

  // don't block rendering while form syncs — show modal/loading when visible
  if (!visible) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // send updated object back to parent; parent will handle Firestore write
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Listing</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {!form ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  value={form.title}
                  onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                  style={styles.input}
                />

                <Text style={styles.label}>Price (read-only)</Text>
                <TextInput
                  value={String(form.priceValue || "")}
                  editable={false}
                  style={[styles.input, { opacity: 0.7 }]}
                />

                <Text style={styles.label}>Location</Text>
                <TextInput
                  value={form.location}
                  onChangeText={(t) => setForm((p) => ({ ...p, location: t }))}
                  style={styles.input}
                />

                <Text style={styles.label}>Address</Text>
                <TextInput
                  value={form.address || ""}
                  onChangeText={(t) => setForm((p) => ({ ...p, address: t }))}
                  style={styles.input}
                />

                <Text style={styles.label}>Type</Text>
                <TextInput
                  value={form.type || ""}
                  onChangeText={(t) => setForm((p) => ({ ...p, type: t }))}
                  style={styles.input}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Beds</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={form.beds?.toString() || ""}
                      onChangeText={(t) =>
                        setForm((p) => ({ ...p, beds: t ? Number(t) : null }))
                      }
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Baths</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={form.baths?.toString() || ""}
                      onChangeText={(t) =>
                        setForm((p) => ({ ...p, baths: t ? Number(t) : null }))
                      }
                      style={styles.input}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Area</Text>
                <TextInput
                  value={form.area || ""}
                  onChangeText={(t) => setForm((p) => ({ ...p, area: t }))}
                  style={styles.input}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  value={form.description || ""}
                  onChangeText={(t) =>
                    setForm((p) => ({ ...p, description: t }))
                  }
                  multiline
                  style={[styles.input, { height: 90 }]}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setForm((p) => ({ ...p, noFee: !p.noFee }))}
                    style={{ marginRight: 12 }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        form.noFee && styles.checkboxActive,
                      ]}
                    />
                  </TouchableOpacity>
                  <Text style={styles.label}>No Agent Fee</Text>
                </View>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.saveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    height: "80%",
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  title: { fontSize: 18, fontWeight: "700" },
  close: { color: "#2563eb", fontWeight: "700" },
  content: { padding: 16 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  checkboxActive: { backgroundColor: "#10b981" },
  saveBtn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveText: { color: "white", fontWeight: "700" },
});

export default EditListingModal;
