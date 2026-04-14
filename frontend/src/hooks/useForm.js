/**
 * Form management hook for handling input values, validation, and submission state.
 * @param {Object} initialValues - Initial state for the form fields.
 * @param {Function} validate - Optional validation function that returns errors.
 */
import { useState } from 'react';

export const useForm = (initialValues, validate) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  /**
   * Universal change handler for various input types.
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    
    setValues(prev => ({
      ...prev,
      [name]: finalValue,
    }));

    if (touched[name]) {
      setErrors(prev => (validate ? validate({ ...values, [name]: finalValue }) : prev));
    }
  };

  /**
   * Tracks which fields have been touched by the user.
   */
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched({
      ...touched,
      [name]: true,
    });

    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    }
  };

  /**
   * Resets the form to its initial state.
   */
  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  const setFieldValue = (name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    resetForm,
    setFieldValue,
    setValues,
    setErrors,
  };
};