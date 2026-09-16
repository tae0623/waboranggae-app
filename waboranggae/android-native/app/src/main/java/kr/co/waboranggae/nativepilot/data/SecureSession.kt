package kr.co.waboranggae.nativepilot.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface SessionStore {
    fun read(): String?
    fun write(refresh: String?)
}
/** Only refresh tokens persist, encrypted with a non-exportable Android Keystore key.
 * Access tokens and passwords never go into preferences, logs or saved-instance state. */
class SecureSession(context: Context,fileName:String="account-session.bin",private val alias:String="waboranggae-session-v1") : SessionStore {
    private val file = AtomicFile(File(context.noBackupFilesDir, fileName))
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized override fun read(): String? = try {
        if (!file.baseFile.exists()) null else {
            val bytes = file.readFully()
            require(bytes.size in 29..16_384)
            Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128,bytes.copyOfRange(0,12))) }
                .doFinal(bytes.copyOfRange(12,bytes.size)).toString(Charsets.UTF_8)
        }
    } catch (_: Exception) { file.delete(); null }
    @Synchronized override fun write(refresh: String?) {
        if (refresh == null) { file.delete(); return }
        require(refresh.length <= 8192)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE,key()) }
        val bytes=cipher.iv + cipher.doFinal(refresh.toByteArray(Charsets.UTF_8))
        val stream=file.startWrite()
        try { stream.write(bytes); file.finishWrite(stream) } catch(e:Exception) { file.failWrite(stream);throw e }
    }
}
