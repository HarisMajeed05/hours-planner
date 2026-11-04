// export, backup, restore and the Groq powered import of a table pasted from the HRM app
import React, { useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { parseHrm } from '../groq';
import { dateKey, fmtH, fmtTime, parseBackup, toCsv, validateImport } from '../logic';
import { syncNow } from '../account';
import { mutate } from '../store';
import { Btn, Card, Field, Icon, Notice, Pill, Screen, Txt, useTheme } from '../ui';

function Head({ icon, tone, title, sub }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Icon name={icon} size={20} color={tone} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Txt v="title">{title}</Txt>
        {sub ? <Txt v="small" color="dim">{sub}</Txt> : null}
      </View>
    </View>
  );
}

export default function DataTools({ onClose, days, settings }) {
  const { c } = useTheme();
  const [restoreText, setRestoreText] = useState('');
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const share = (message, title) => Share.share({ message, title }).catch(() => {});

  function restore() {
    try {
      const { days: back } = parseBackup(restoreText.trim());
      const n = Object.keys(back).length;
      Alert.alert('Restore backup', `This replaces all ${Object.keys(days).length} saved days with ${n} days from the backup.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            await mutate((st) => ({ ...st, days: back }));
            syncNow({ replace: true }).catch(() => {}); // the cloud copy becomes the restored one too
            setRestoreText('');
            setMsg(`Restored ${n} days.`);
          },
        },
      ]);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function readTable() {
    setBusy(true);
    setMsg('');
    setPreview(null);
    try {
      const parsed = await parseHrm({ model: settings.model, text: pasted, today: dateKey(new Date()) });
      setPreview(validateImport(parsed, new Date()));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyImport() {
    const rows = preview.ok;
    await mutate((st) => {
      const next = { ...st.days };
      for (const r of rows) next[r.key] = { ...(next[r.key] ?? {}), sessions: [{ in: r.in, out: r.out }] };
      return { ...st, days: next };
    });
    setMsg(`Imported ${rows.length} days.`);
    setPreview(null);
    setPasted('');
  }

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 }}>
      <Screen contentStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ marginRight: 12 }}>
            <Icon name="chevronL" size={28} />
          </Pressable>
          <View>
            <Txt v="h1">Data tools</Txt>
            <Txt v="small" color="dim">Your data, your way out</Txt>
          </View>
        </View>

        {msg ? <Notice tone="info" text={msg} style={{ marginTop: 0, marginBottom: 12 }} /> : null}

        <Card>
          <Head icon="share" tone="brand" title="Export and backup" sub="Opens the share sheet" />
          <Txt v="small" color="dim" style={{ marginBottom: 12 }}>Send it to Drive, WhatsApp, Keep or email. Do this before old days drop off after 3 months.</Txt>
          <Btn label="Share as CSV" icon="file" kind="ghost" onPress={() => share(toCsv(days), 'Hours Planner export')} />
          <Btn label="Share full backup" icon="download" kind="ghost" onPress={() => share(JSON.stringify({ v: 2, days, settings }), 'Hours Planner backup')} style={{ marginTop: 8 }} />
        </Card>

        <Card>
          <Head icon="upload" tone="warn" title="Restore a backup" sub="Replaces everything saved on this phone" />
          <Field multiline value={restoreText} onChangeText={setRestoreText} placeholder="Paste the backup text here" autoCapitalize="none" />
          <Btn label="Restore" icon="refresh" kind="danger" onPress={restore} disabled={!restoreText.trim()} />
        </Card>

        <Card>
          <Head icon="sparkles" tone="brand2" title="Import from the HRM app" sub="Groq reads it, you check it first" />
          <Txt v="small" color="dim" style={{ marginBottom: 12 }}>Copy your attendance table from the HRM app and paste it. Days with the same date are replaced.</Txt>
          <Field multiline value={pasted} onChangeText={setPasted} placeholder="Paste the table here" autoCapitalize="none" inputStyle={{ minHeight: 120 }} />
          <Btn label={busy ? 'Reading...' : 'Read with Groq'} icon="wand" onPress={readTable} disabled={busy || !pasted.trim()} />

          {preview ? (
            <View style={{ marginTop: 16 }}>
              <Pill label={`${preview.ok.length} days found`} icon="checkCircle" tone="good" />
              {preview.ok.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <Txt v="small" w={600}>{r.key}</Txt>
                  <Txt v="small" color="dim">{fmtTime(r.in)} to {fmtTime(r.out)} · {fmtH((r.out - r.in) / 3600000)}{days[r.key] ? ' · replaces' : ''}</Txt>
                </View>
              ))}
              {preview.rejected.length ? <Notice tone="warn" text={`Skipped ${preview.rejected.length}: ${preview.rejected.map((r) => `${r.date} (${r.why})`).join(', ')}`} /> : null}
              <Btn label={`Import ${preview.ok.length} days`} icon="download" onPress={applyImport} disabled={!preview.ok.length} style={{ marginTop: 14 }} />
            </View>
          ) : null}
        </Card>
      </Screen>
    </View>
  );
}
