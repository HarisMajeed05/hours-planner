// one place that decides which Lucide icon each name means. icons are imported one by one so the bundle stays small
import React from 'react';
import Activity from 'lucide-react-native/icons/activity';
import AlarmClock from 'lucide-react-native/icons/alarm-clock';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bars from 'lucide-react-native/icons/chart-no-axes-column';
import Bell from 'lucide-react-native/icons/bell';
import BellRing from 'lucide-react-native/icons/bell-ring';
import Bot from 'lucide-react-native/icons/bot';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Calendar from 'lucide-react-native/icons/calendar';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import CheckCircle from 'lucide-react-native/icons/circle-check';
import ChevronL from 'lucide-react-native/icons/chevron-left';
import ChevronR from 'lucide-react-native/icons/chevron-right';
import Cloud from 'lucide-react-native/icons/cloud';
import Clock from 'lucide-react-native/icons/clock';
import Coffee from 'lucide-react-native/icons/coffee';
import Database from 'lucide-react-native/icons/database';
import Download from 'lucide-react-native/icons/download';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import File from 'lucide-react-native/icons/file-text';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import Flame from 'lucide-react-native/icons/flame';
import Gauge from 'lucide-react-native/icons/gauge';
import History from 'lucide-react-native/icons/rotate-ccw-clock';
import Home from 'lucide-react-native/icons/house';
import Hourglass from 'lucide-react-native/icons/hourglass';
import ImageIcon from 'lucide-react-native/icons/image';
import Info from 'lucide-react-native/icons/info';
import Key from 'lucide-react-native/icons/key-round';
import Laptop from 'lucide-react-native/icons/laptop';
import Layers from 'lucide-react-native/icons/layers';
import Bulb from 'lucide-react-native/icons/lightbulb';
import Link from 'lucide-react-native/icons/link';
import Lock from 'lucide-react-native/icons/lock';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Message from 'lucide-react-native/icons/message-circle';
import Mic from 'lucide-react-native/icons/mic';
import MicOff from 'lucide-react-native/icons/mic-off';
import Moon from 'lucide-react-native/icons/moon';
import Nav from 'lucide-react-native/icons/navigation';
import Palette from 'lucide-react-native/icons/palette';
import Palm from 'lucide-react-native/icons/tree-palm';
import Party from 'lucide-react-native/icons/party-popper';
import Pause from 'lucide-react-native/icons/circle-pause';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/smartphone';
import Pin from 'lucide-react-native/icons/map-pin';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import Radar from 'lucide-react-native/icons/radar';
import Refresh from 'lucide-react-native/icons/refresh-cw';
import Rocket from 'lucide-react-native/icons/rocket';
import Send from 'lucide-react-native/icons/send';
import Settings from 'lucide-react-native/icons/settings';
import Share from 'lucide-react-native/icons/share-2';
import Shield from 'lucide-react-native/icons/shield-check';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Sun from 'lucide-react-native/icons/sun';
import SunMedium from 'lucide-react-native/icons/sun-medium';
import Sunrise from 'lucide-react-native/icons/sunrise';
import Sunset from 'lucide-react-native/icons/sunset';
import Target from 'lucide-react-native/icons/target';
import Timer from 'lucide-react-native/icons/timer';
import Trash from 'lucide-react-native/icons/trash';
import TrendDown from 'lucide-react-native/icons/trending-down';
import TrendUp from 'lucide-react-native/icons/trending-up';
import Upload from 'lucide-react-native/icons/upload';
import User from 'lucide-react-native/icons/user';
import Wand from 'lucide-react-native/icons/wand-sparkles';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';
import { useTheme } from './theme';

const MAP = {
  activity: Activity, alarm: AlarmClock, arrowR: ArrowRight, bars: Bars, bell: Bell, bellRing: BellRing, bot: Bot,
  briefcase: Briefcase, calendar: Calendar, calendarDays: CalendarDays, check: Check, checkCircle: CheckCircle,
  camera: Camera, cloud: Cloud, image: ImageIcon, mail: Mail, pencil: Pencil,
  chevronL: ChevronL, chevronR: ChevronR, clock: Clock, coffee: Coffee, database: Database, download: Download,
  eye: Eye, eyeOff: EyeOff, file: File, fingerprint: Fingerprint, flame: Flame, gauge: Gauge, history: History,
  home: Home, hourglass: Hourglass, info: Info, key: Key, laptop: Laptop, layers: Layers, bulb: Bulb, link: Link,
  lock: Lock, login: LogIn, logout: LogOut, chat: Message, mic: Mic, micOff: MicOff, moon: Moon, nav: Nav,
  palette: Palette, palm: Palm, party: Party, pause: Pause, phone: Phone, pin: Pin, play: Play, plus: Plus, radar: Radar,
  refresh: Refresh, rocket: Rocket, send: Send, settings: Settings, share: Share, shield: Shield, sparkles: Sparkles,
  sun: Sun, sunMedium: SunMedium, sunrise: Sunrise, sunset: Sunset, target: Target, timer: Timer, trash: Trash,
  trendDown: TrendDown, trendUp: TrendUp, upload: Upload, user: User, wand: Wand, x: X, zap: Zap,
};

// color is a theme token or any color string
export function Icon({ name, size = 20, color = 'text', stroke = 2, style }) {
  const { c } = useTheme();
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={c[color] ?? color} strokeWidth={stroke} style={style} />;
}
