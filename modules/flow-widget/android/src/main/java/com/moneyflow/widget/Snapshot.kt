package com.moneyflow.widget

import android.content.Context
import android.graphics.Color
import org.json.JSONObject

/** The last snapshot the app saved (see utils/widget.ts): every string is already formatted. */
class Snapshot(private val o: JSONObject) {
  class Row(val label: String, val value: String)
  class Quick(val label: String, val color: Int, val url: String)
  class Top(val label: String, val color: Int, val value: String)

  val pro get() = o.optBoolean("pro")
  val homeUrl get() = o.optString("homeUrl", "")
  val lockedText get() = o.optString("lockedText", "")
  val lockedUrl get() = o.optString("lockedUrl", "")
  val emptyText get() = o.optString("emptyText", "")
  val title get() = o.optString("title", "")
  val perDay get() = o.optString("perDay", "")
  val aDay get() = o.optString("aDay", "")
  val progress get() = o.optDouble("progress", 0.0).toFloat()
  val dayLine get() = o.optString("dayLine", "")
  val verdict get() = o.optString("verdict", "")
  val quickTitle get() = o.optString("quickTitle", "")
  val topTitle get() = o.optString("topTitle", "")

  val top: List<Top>
    get() {
      val a = o.optJSONArray("top") ?: return emptyList()
      return (0 until a.length()).mapNotNull { i ->
        a.optJSONObject(i)?.let { Top(it.optString("label"), parse(it.optString("color")) ?: Color.GRAY, it.optString("value")) }
      }
    }

  fun color(name: String, fallback: Int): Int {
    val hex = o.optJSONObject("colors")?.optString(name, "") ?: ""
    return parse(hex) ?: fallback
  }

  val rows: List<Row>
    get() {
      val a = o.optJSONArray("rows") ?: return emptyList()
      return (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let { Row(it.optString("label"), it.optString("value")) } }
    }

  val quick: List<Quick>
    get() {
      val a = o.optJSONArray("quick") ?: return emptyList()
      return (0 until a.length()).mapNotNull { i ->
        a.optJSONObject(i)?.let { Quick(it.optString("label"), parse(it.optString("color")) ?: Color.GRAY, it.optString("url")) }
      }
    }

  companion object {
    private const val PREFS = "flow_widget"
    private const val KEY = "snapshot"

    fun save(ctx: Context, json: String) {
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun load(ctx: Context): Snapshot? {
      val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return null
      return try { Snapshot(JSONObject(raw)) } catch (e: Exception) { null }
    }

    /** "#RRGGBB" or "#RRGGBBAA" (the app writes alpha last, Android wants it first). */
    fun parse(hex: String): Int? = try {
      when (hex.length) {
        7 -> Color.parseColor(hex)
        9 -> Color.parseColor("#" + hex.substring(7, 9) + hex.substring(1, 7))
        else -> null
      }
    } catch (e: Exception) { null }
  }
}
