// the home screen widget. it shows today and the month at a glance and has one check in / check out button.
// it redraws when I change anything in the app and every 30 minutes, so the hours are a snapshot, not a live timer
import React from 'react';
import { FlexWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import { checkInDay, checkOutDay, dateKey, fmtH, fmtTime, isLive, monthStats } from './logic';
import { onWrite, read, updateDay } from './store';

const NAME = 'HoursPlanner';

function HoursWidget({ st, now }) {
  const row = st.rows.find((r) => r.key === st.todayKey);
  const state = row?.state ?? 'none';
  const sub =
    state === 'live' ? `Leave at ${fmtTime(row.planOutMs)}` :
    state === 'today' && row.planInMs ? `Check in ${fmtTime(row.planInMs)}, leave ${fmtTime(row.planOutMs)}` :
    state === 'break' ? `Out of office, ${fmtH(Math.max(0, st.todayPlan - st.todayH))} to go` :
    state === 'done' ? 'Done for today' : 'No office today';
  const button = state === 'live' ? 'Check out' : 'Check in';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ width: 'match_parent', height: 'match_parent', backgroundGradient: { from: '#5B3DF5', to: '#14B8E6', orientation: 'TL_BR' }, borderRadius: 26, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={`${fmtH(st.todayH)} today`} style={{ fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' }} />
        <TextWidget text={sub} style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.95)' }} maxLines={2} />
        <TextWidget text={`${fmtH(st.remaining)} left this month, ${st.daysLeft} days`} style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.78)', marginTop: 4 }} maxLines={2} />
        <TextWidget text={`updated ${fmtTime(now.getTime())}`} style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.6)', marginTop: 2 }} />
      </FlexWidget>
      <FlexWidget clickAction="TOGGLE" style={{ backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }}>
        <TextWidget text={button} style={{ fontSize: 14, fontWeight: 'bold', color: state === 'live' ? '#BE123C' : '#3B2BB5' }} />
      </FlexWidget>
    </FlexWidget>
  );
}

async function render() {
  const { settings, days } = await read();
  const now = new Date();
  return <HoursWidget st={monthStats(days, settings, now)} now={now} />;
}

// the button on the widget does the same as the button in the app
async function toggle() {
  const now = Date.now();
  const k = dateKey(new Date(now));
  await updateDay(k, (d) => (isLive(d) ? checkOutDay(d, now) : checkInDay(d, now)));
}

registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, clickAction, renderWidget }) => {
  if (widgetInfo.widgetName !== NAME) return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE') await toggle();
  if (widgetAction !== 'WIDGET_DELETED') renderWidget(await render());
});

export const refreshWidget = () => requestWidgetUpdate({ widgetName: NAME, renderWidget: render }).catch(() => {});

// every write to my data redraws the widget
onWrite(() => {
  refreshWidget();
});
