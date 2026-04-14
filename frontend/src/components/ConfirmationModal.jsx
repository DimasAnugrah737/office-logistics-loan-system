import React from 'react';
import { FiTriangle, FiX } from 'react-icons/fi';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger',
    icon: Icon = FiTriangle
}) => {
    if (!isOpen) return null;

    const typeStyles = {
        danger: {
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none',
        },
        warning: {
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 dark:shadow-none',
        },
        primary: {
            iconBg: 'bg-theme-primary-light',
            iconColor: 'text-theme-primary',
            confirmBtn: 'bg-theme-primary hover:bg-theme-primary text-white shadow-theme-primary/20 dark:shadow-none',
        }
    };

    const currentStyle = typeStyles[type] || typeStyles.primary;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Overlay */}
                <div
                    className="fixed inset-0 transition-opacity bg-gray-900/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal Content */}
                <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-none text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-100 dark:border-gray-700">
                    <div className="absolute right-4 top-4">
                        <button
                            onClick={onClose}
                            className="p-1 rounded-none text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="px-6 pt-8 pb-6">
                        <div className="sm:flex sm:items-start">
                            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-none ${currentStyle.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
                                <Icon className={`h-6 w-6 ${currentStyle.iconColor}`} />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-6">
                                    {title}
                                </h3>
                                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    {message}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row-reverse gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`inline-flex justify-center w-full px-4 py-2.5 rounded-none text-sm font-bold transition-all duration-200 shadow-lg ${currentStyle.confirmBtn}`}
                        >
                            {confirmText}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex justify-center w-full px-4 py-2.5 rounded-none text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
