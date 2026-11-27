package com.moneyflow.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Builds the RemoteViews for both widgets from the saved snapshot. */
object Draw {
  private val DARK_BG = Color.rgb(14, 14, 24)
  private val DARK_BG2 = Color.rgb(30, 30, 46)
  private val INK = Color.rgb(234, 234, 242)
  private val MUTE = Color.rgb(136, 136, 170)
  private val DIM = Color.rgb(85, 85, 106)
  private val ACCENT = Color.rgb(0, 224, 158)

  fun redrawAll(ctx: Context) {
    val m = AppWidgetManager.getInstance(ctx)
    for (id in m.getAppWidgetIds(ComponentName(ctx, SafeToSpendProvider::class.java))) safe(ctx, m, id)
    for (id in m.getAppWidgetIds(ComponentName(ctx, QuickAddProvider::class.java))) quick(ctx, m, id)
  }

  private fun open(ctx: Context, url: String, req: Int): PendingIntent? {
    if (url.isEmpty()) return null
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(ctx, req, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Widget size in dp, taking the portrait pair of the two Android reports. */
  private fun size(ctx: Context, manager: AppWidgetManager, id: Int): Pair<Int, Int> {
    val o = manager.getAppWidgetOptions(id)
    val portrait = ctx.resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE
    val minW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
    val minH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
    val maxW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minW)
    val maxH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minH)
    return if (portrait) Pair(minW, max(minH, maxH)) else Pair(max(minW, maxW), minH)
  }

  private fun rounded(w: Int, h: Int, color: Int, border: Int, radius: Float): Bitmap {
    val bmp = Bitmap.createBitmap(max(1, w), max(1, h), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = color
    c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), radius, radius, p)
    p.style = Paint.Style.STROKE
    p.strokeWidth = 2f
    p.color = border
    c.drawRoundRect(RectF(1f, 1f, w - 1f, h - 1f), radius, radius, p)
    return bmp
  }

  private fun bar(w: Int, h: Int, progress: Float, track: Int, fill: Int): Bitmap {
    val bmp = Bitmap.createBitmap(max(1, w), max(1, h), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    val r = h / 2f
    p.color = track
    c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), r, r, p)
    p.color = fill
    c.drawRoundRect(RectF(0f, 0f, w * min(1f, max(0f, progress)), h.toFloat()), r, r, p)
    return bmp
  }

  private fun dot(sizePx: Int, color: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = (color and 0x00FFFFFF) or 0x33000000
    c.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, p)
    p.color = color
    c.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 4f, p)
    return bmp
  }

  fun safe(ctx: Context, manager: AppWidgetManager, id: Int) {
    val views = RemoteViews(ctx.packageName, R.layout.fw_safe)
    val snap = Snapshot.load(ctx)
    val d = ctx.resources.displayMetrics.density
    val (wDp, hDp) = size(ctx, manager, id)
    val bg = snap?.color("bg", DARK_BG) ?: DARK_BG
    val bg2 = snap?.color("bg2", DARK_BG2) ?: DARK_BG2
    val border = snap?.color("border", DARK_BG2) ?: DARK_BG2
    val text1 = snap?.color("text1", INK) ?: INK
    val text2 = snap?.color("text2", MUTE) ?: MUTE
    val text3 = snap?.color("text3", DIM) ?: DIM
    val tone = snap?.color("tone", ACCENT) ?: ACCENT
    views.setImageViewBitmap(R.id.fw_bg, rounded((wDp * d).roundToInt(), (hDp * d).roundToInt(), bg, border, 22 * d))

    if (snap == null) {
      views.setViewVisibility(R.id.fw_content, View.GONE)
      views.setViewVisibility(R.id.fw_locked, View.GONE)
      views.setViewVisibility(R.id.fw_empty, View.VISIBLE)
      manager.updateAppWidget(id, views)
      return
    }
    views.setViewVisibility(R.id.fw_empty, View.GONE)

    // 2×2 is the free size; anything wider or taller is Pro. Samsung's
    // launcher says how many cells it gave us; others get judged by dp
    // (a 2-column widget is under ~200dp wide, three rows are ~300dp+).
    val o = manager.getAppWidgetOptions(id)
    val cols = o.getInt("semAppWidgetColumnSpan", 0)
    val rowSpan = o.getInt("semAppWidgetRowSpan", 0)
    val small = if (cols > 0) cols <= 2 else wDp < 200
    val tall = if (rowSpan > 0) rowSpan >= 3 else hDp >= 300
    if (!small && !snap.pro) {
      views.setViewVisibility(R.id.fw_content, View.GONE)
      views.setViewVisibility(R.id.fw_locked, View.VISIBLE)
      views.setTextViewText(R.id.fw_locked, snap.lockedText)
      views.setTextColor(R.id.fw_locked, text2)
      open(ctx, snap.lockedUrl, id)?.let { views.setOnClickPendingIntent(R.id.fw_root, it) }
      manager.updateAppWidget(id, views)
      return
    }
    views.setViewVisibility(R.id.fw_locked, View.GONE)
    views.setViewVisibility(R.id.fw_content, View.VISIBLE)

    views.setTextViewText(R.id.fw_title, snap.title)
    views.setTextColor(R.id.fw_title, text2)
    views.setTextViewText(R.id.fw_perday, snap.perDay)
    views.setTextColor(R.id.fw_perday, text1)
    views.setTextViewTextSize(R.id.fw_perday, TypedValue.COMPLEX_UNIT_SP, if (small) 22f else if (tall) 30f else 26f)
    views.setTextViewText(R.id.fw_aday, snap.aDay)
    views.setTextColor(R.id.fw_aday, text2)
    views.setImageViewBitmap(R.id.fw_bar, bar(((wDp - 28) * d).roundToInt(), (6 * d).roundToInt(), snap.progress, bg2, tone))
    views.setTextViewText(R.id.fw_dayline, snap.dayLine)
    views.setTextColor(R.id.fw_dayline, text3)
    views.setTextViewText(R.id.fw_verdict, snap.verdict)
    views.setTextColor(R.id.fw_verdict, tone)
    // A squat 2×2 (short cells) has no room for the verdict.
    views.setViewVisibility(R.id.fw_verdict, if (small && hDp < 150) View.GONE else View.VISIBLE)

    val rows = snap.rows
    val showRows = tall && rows.isNotEmpty()
    views.setViewVisibility(R.id.fw_rows, if (showRows) View.VISIBLE else View.GONE)
    if (showRows) {
      val labels = intArrayOf(R.id.fw_l1, R.id.fw_l2, R.id.fw_l3, R.id.fw_l4)
      val values = intArrayOf(R.id.fw_v1, R.id.fw_v2, R.id.fw_v3, R.id.fw_v4)
      for (i in 0 until 4) {
        val r = rows.getOrNull(i)
        views.setTextViewText(labels[i], r?.label ?: "")
        views.setTextViewText(values[i], r?.value ?: "")
        views.setTextColor(labels[i], text2)
        views.setTextColor(values[i], text1)
      }
    }
    open(ctx, snap.homeUrl, id)?.let { views.setOnClickPendingIntent(R.id.fw_root, it) }
    manager.updateAppWidget(id, views)
  }

  fun quick(ctx: Context, manager: AppWidgetManager, id: Int) {
    val views = RemoteViews(ctx.packageName, R.layout.fw_quick)
    val snap = Snapshot.load(ctx)
    val d = ctx.resources.displayMetrics.density
    val (wDp, hDp) = size(ctx, manager, id)
    val bg = snap?.color("bg", DARK_BG) ?: DARK_BG
    val border = snap?.color("border", DARK_BG2) ?: DARK_BG2
    val text1 = snap?.color("text1", INK) ?: INK
    val text2 = snap?.color("text2", MUTE) ?: MUTE
    views.setImageViewBitmap(R.id.fw_bg, rounded((wDp * d).roundToInt(), (hDp * d).roundToInt(), bg, border, 22 * d))

    if (snap == null || !snap.pro) {
      views.setViewVisibility(R.id.fw_cells, View.GONE)
      views.setViewVisibility(R.id.fw_locked, View.VISIBLE)
      views.setTextViewText(R.id.fw_locked, snap?.lockedText ?: ctx.getString(R.string.fw_open))
      views.setTextColor(R.id.fw_locked, text2)
      open(ctx, snap?.lockedUrl ?: "", id)?.let { views.setOnClickPendingIntent(R.id.fw_root, it) }
      manager.updateAppWidget(id, views)
      return
    }
    views.setViewVisibility(R.id.fw_locked, View.GONE)
    views.setViewVisibility(R.id.fw_cells, View.VISIBLE)
    val cells = intArrayOf(R.id.fw_c1, R.id.fw_c2, R.id.fw_c3, R.id.fw_c4)
    val dots = intArrayOf(R.id.fw_d1, R.id.fw_d2, R.id.fw_d3, R.id.fw_d4)
    val names = intArrayOf(R.id.fw_n1, R.id.fw_n2, R.id.fw_n3, R.id.fw_n4)
    val q = snap.quick
    for (i in 0 until 4) {
      val item = q.getOrNull(i)
      views.setViewVisibility(cells[i], if (item == null) View.GONE else View.VISIBLE)
      if (item == null) continue
      views.setImageViewBitmap(dots[i], dot((22 * d).roundToInt(), item.color))
      views.setTextViewText(names[i], item.label)
      views.setTextColor(names[i], text1)
      open(ctx, item.url, id * 10 + i)?.let { views.setOnClickPendingIntent(cells[i], it) }
    }
    manager.updateAppWidget(id, views)
  }
}
