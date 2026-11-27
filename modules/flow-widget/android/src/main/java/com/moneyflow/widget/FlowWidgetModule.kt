package com.moneyflow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app's side of the widgets: it hands over a snapshot whenever its numbers change. */
class FlowWidgetModule : Module() {
  private fun provider(kind: String) =
    if (kind == "quick") QuickAddProvider::class.java else SafeToSpendProvider::class.java

  override fun definition() = ModuleDefinition {
    Name("FlowWidget")

    Function("set") { snapshot: String ->
      val ctx = appContext.reactContext ?: return@Function
      Snapshot.save(ctx, snapshot)
      Draw.redrawAll(ctx)
    }

    AsyncFunction("count") { kind: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction 0
      AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, provider(kind))).size
    }

    // Ask the launcher to add the widget; it shows its own confirmation. False when it cannot be asked.
    Function("pin") { kind: String ->
      val ctx = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(ctx)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      manager.requestPinAppWidget(ComponentName(ctx, provider(kind)), null, null)
    }
  }
}
