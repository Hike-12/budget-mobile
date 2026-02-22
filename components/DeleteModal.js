import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/colors';

const DeleteModal = ({ visible, onCancel, onDelete, title }) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.overlay} onPress={onCancel}>
                <View style={styles.centeredView}>
                    <Pressable style={styles.modalView}>
                        <Text style={styles.modalTitle}>Delete Transaction</Text>
                        <Text style={styles.modalText}>
                            Are you sure you want to delete <Text style={styles.highlight}>{title}</Text>? This action cannot be undone.
                        </Text>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={onCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.deleteButton]}
                                onPress={onDelete}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.deleteButtonText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    centeredView: {
        width: '100%',
        maxWidth: 400,
    },
    modalView: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.accent,
        marginBottom: 12,
    },
    modalText: {
        fontSize: 14,
        color: Colors.secondary,
        lineHeight: 20,
        marginBottom: 24,
    },
    highlight: {
        color: Colors.accent,
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cancelButtonText: {
        color: Colors.accent,
        fontWeight: '500',
        fontSize: 14,
    },
    deleteButton: {
        backgroundColor: Colors.red,
    },
    deleteButtonText: {
        color: Colors.dark,
        fontWeight: '600',
        fontSize: 14,
    },
});

export default DeleteModal;
