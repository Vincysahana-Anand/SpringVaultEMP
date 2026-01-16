import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { updateCustomer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  doorNumber?: string;
  floor?: string;
  street?: string;
  area?: string;
  alternateContacts?: string[];
  advanceAmount?: number;
  canHolding?: number;
  extraCanHolding?: number;
  customerType?: string;
  billingType?: string;
  price?: number;
  balance?: number;
}

interface EditCustomerScreenProps {
  customer: Customer;
  onBack: () => void;
  onSave: (updatedCustomer: Customer) => void;
}

export default function EditCustomerScreen({ customer, onBack, onSave }: EditCustomerScreenProps) {
  const [formData, setFormData] = useState<Customer>(customer);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const handleBackPress = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [onBack]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.mobile?.trim()) {
      newErrors.mobile = 'Mobile is required';
    }
    if (formData.mobile && formData.mobile.length < 10) {
      newErrors.mobile = 'Mobile must be at least 10 digits';
    }
    if (!formData.doorNumber?.trim()) {
      newErrors.doorNumber = 'Door number is required';
    }
    if (!formData.area?.trim()) {
      newErrors.area = 'Area is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await updateCustomer(formData.id, formData as any);
      onSave(formData);
    } catch (e) {
      const err = handleServiceError(e, 'updateCustomer');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof Customer, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Customer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <Text style={styles.sectionTitle}>Basic Information</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Enter customer name"
            placeholderTextColor={colors.gray[400]}
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
            editable={!loading}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput
            style={[styles.input, errors.mobile && styles.inputError]}
            placeholder="Enter mobile number"
            placeholderTextColor={colors.gray[400]}
            value={formData.mobile}
            onChangeText={(value) => updateField('mobile', value)}
            keyboardType="phone-pad"
            editable={!loading}
          />
          {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Alternate Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter alternate mobile number"
            placeholderTextColor={colors.gray[400]}
            value={formData.alternateContacts?.[0] || ''}
            onChangeText={(value) =>
              updateField('alternateContacts', value ? [value] : [])
            }
            keyboardType="phone-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Customer Type</Text>
          <View style={styles.typeSelector}>
            {['Residence', 'Shop', 'Party'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  formData.customerType === type && styles.typeButtonActive,
                ]}
                onPress={() => updateField('customerType', type)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.customerType === type && styles.typeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address Information */}
        <Text style={[styles.sectionTitle, { marginTop: spacing[24] }]}>Address</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Door Number *</Text>
          <TextInput
            style={[styles.input, errors.doorNumber && styles.inputError]}
            placeholder="Enter door number"
            placeholderTextColor={colors.gray[400]}
            value={formData.doorNumber}
            onChangeText={(value) => updateField('doorNumber', value)}
            editable={!loading}
          />
          {errors.doorNumber && <Text style={styles.errorText}>{errors.doorNumber}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Floor</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter floor number"
            placeholderTextColor={colors.gray[400]}
            value={formData.floor}
            onChangeText={(value) => updateField('floor', value)}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Street</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter street name"
            placeholderTextColor={colors.gray[400]}
            value={formData.street}
            onChangeText={(value) => updateField('street', value)}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Area *</Text>
          <TextInput
            style={[styles.input, errors.area && styles.inputError]}
            placeholder="Enter area name"
            placeholderTextColor={colors.gray[400]}
            value={formData.area}
            onChangeText={(value) => updateField('area', value)}
            editable={!loading}
          />
          {errors.area && <Text style={styles.errorText}>{errors.area}</Text>}
        </View>

        {/* Billing Information */}
        <Text style={[styles.sectionTitle, { marginTop: spacing[24] }]}>Billing</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Advance Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter advance amount"
            placeholderTextColor={colors.gray[400]}
            value={formData.advanceAmount?.toString() || ''}
            onChangeText={(value) => updateField('advanceAmount', value ? parseInt(value) : 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Billing Type</Text>
          <View style={styles.billingSelector}>
            {['Cash', 'Rotational Payment', 'Monthly Payment', 'Online'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.billingButton,
                  formData.billingType === type && styles.billingButtonActive,
                ]}
                onPress={() => updateField('billingType', type)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.billingButtonText,
                    formData.billingType === type && styles.billingButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Price per Can (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter price per can"
            placeholderTextColor={colors.gray[400]}
            value={formData.price?.toString() || ''}
            onChangeText={(value) => updateField('price', value ? parseInt(value) : 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Balance</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter balance amount"
            placeholderTextColor={colors.gray[400]}
            value={(formData.balance ?? 0).toString()}
            onChangeText={(value) => updateField('balance', value ? parseInt(value) : 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        {/* Can Holdings */}
        <Text style={[styles.sectionTitle, { marginTop: spacing[24] }]}>Can Holdings</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Can Holding</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter number of cans"
            placeholderTextColor={colors.gray[400]}
            value={formData.canHolding?.toString() || ''}
            onChangeText={(value) => updateField('canHolding', value ? parseInt(value) : 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Extra Can Holding</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter extra cans holding"
            placeholderTextColor={colors.gray[400]}
            value={formData.extraCanHolding?.toString() || ''}
            onChangeText={(value) => updateField('extraCanHolding', value ? parseInt(value) : 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onBack}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing[8],
    marginLeft: -spacing[8],
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
    paddingBottom: spacing[20],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[12],
  },
  formGroup: {
    marginBottom: spacing[16],
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[8],
  },
  input: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
  },
  inputError: {
    borderColor: colors.danger[500],
  },
  errorText: {
    color: colors.danger[500],
    fontSize: typography.fontSize.sm,
    marginTop: spacing[4],
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing[8],
    flexWrap: 'wrap',
  },
  typeButton: {
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.bg.white,
  },
  typeButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  typeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[700],
    textAlign: 'center',
  },
  typeButtonTextActive: {
    color: colors.primary[700],
  },
  billingSelector: {
    gap: spacing[8],
  },
  billingButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.bg.white,
  },
  billingButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  billingButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[700],
  },
  billingButtonTextActive: {
    color: colors.primary[700],
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
    gap: spacing[12],
    backgroundColor: colors.bg.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: colors.bg.white,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  saveButton: {
    backgroundColor: colors.primary[500],
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
});
