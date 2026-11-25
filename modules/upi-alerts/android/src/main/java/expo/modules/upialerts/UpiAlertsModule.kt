package expo.modules.upialerts

import android.Manifest
import android.app.Notification
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val DAY_MS = 86_400_000L

private object CaptureBuffer {
  private val upi = Regex("""\b(upi|vpa|rrn|gpay|google pay)\b""", RegexOption.IGNORE_CASE)
  private val transfer = Regex("""\b(debited|credited|paid|received|sent|transferred)\b""", RegexOption.IGNORE_CASE)
  private val bankAccount = Regex("""\b(a/c|acct|account)\b""", RegexOption.IGNORE_CASE)
  private val bankDirection = Regex("""\b(debited|credited|dr|cr)\b""", RegexOption.IGNORE_CASE)
  private val currencyAmount = Regex("""(?:₹|\b(?:inr|rs\.?))\s*\d""", RegexOption.IGNORE_CASE)
  private val ignored = Regex("""\b(otp|declined|failed|pending|requested|refunded|reversed|verification code|payment due|credit card bill)\b""", RegexOption.IGNORE_CASE)

  private fun prefs(context: Context) = context.getSharedPreferences("upi_alerts", Context.MODE_PRIVATE)

  fun candidate(body: String): Boolean {
    if (ignored.containsMatchIn(body)) return false
    return (upi.containsMatchIn(body) && transfer.containsMatchIn(body)) ||
      (bankAccount.containsMatchIn(body) && bankDirection.containsMatchIn(body) && currencyAmount.containsMatchIn(body))
  }

  @Synchronized
  fun setOwner(context: Context, user: String?) {
    val stored = prefs(context)
    if (stored.getString("owner", null) == user) return
    stored.edit().putString("owner", user).remove("queue").apply()
  }

  private fun entries(context: Context): List<JSONObject> {
    val array = JSONArray(prefs(context).getString("queue", "[]"))
    val cutoff = System.currentTimeMillis() - 7 * DAY_MS
    return (0 until array.length()).map(array::getJSONObject).filter { it.getLong("savedAt") >= cutoff }
  }

  @Synchronized
  fun add(context: Context, body: String, timestamp: Long) {
    val stored = prefs(context)
    if (stored.getString("owner", null) == null || !candidate(body)) return
    val item = JSONObject().put("id", UUID.randomUUID().toString())
      .put("body", body.take(1200)).put("timestamp", timestamp).put("savedAt", System.currentTimeMillis())
    stored.edit().putString("queue", JSONArray((entries(context) + item).takeLast(200)).toString()).apply()
  }

  @Synchronized
  fun read(context: Context, user: String): List<Map<String, Any>> {
    if (prefs(context).getString("owner", null) != user) return emptyList()
    return entries(context).map {
      mapOf("id" to it.getString("id"), "body" to it.getString("body"), "timestamp" to it.getLong("timestamp"))
    }
  }

  @Synchronized
  fun acknowledge(context: Context, user: String, ids: List<String>) {
    val stored = prefs(context)
    if (stored.getString("owner", null) != user) return
    val remaining = entries(context).filterNot { it.getString("id") in ids }
    stored.edit().putString("queue", JSONArray(remaining).toString()).apply()
  }
}

class UpiSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    val first = messages.firstOrNull() ?: return
    CaptureBuffer.add(context, messages.joinToString("") { it.messageBody.orEmpty() }, first.timestampMillis)
  }
}

class UpiNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName != "com.google.android.apps.nbu.paisa.user") return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)
    val body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT)
    CaptureBuffer.add(this, listOfNotNull("Google Pay:", title, body).joinToString(" "), sbn.postTime)
  }
}

class UpiAlertsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("UpiAlerts")

    Function("setCaptureOwner") { user: String? -> CaptureBuffer.setOwner(context, user) }
    AsyncFunction("pendingAlerts") { user: String -> CaptureBuffer.read(context, user) }
    AsyncFunction("acknowledge") { user: String, ids: List<String> -> CaptureBuffer.acknowledge(context, user, ids) }
    Function("hasNotificationAccess") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }
    Function("openNotificationSettings") {
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("scanRecentSms") {
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("SMS permission is required to scan your inbox")
      }
      val alerts = mutableListOf<Map<String, Any>>()
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms.BODY, Telephony.Sms.DATE),
        "date >= ?", arrayOf((System.currentTimeMillis() - 7 * DAY_MS).toString()), "date DESC"
      )?.use { cursor ->
        while (alerts.size < 200 && cursor.moveToNext()) {
          val body = cursor.getString(0).orEmpty()
          if (CaptureBuffer.candidate(body)) {
            alerts.add(mapOf("body" to body.take(1200), "timestamp" to cursor.getLong(1)))
          }
        }
      }
      alerts
    }
  }
}
