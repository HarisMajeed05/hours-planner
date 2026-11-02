import { registerRootComponent } from 'expo';
import './src/device'; // defines the office geofence task
import './src/widget'; // registers the home screen widget handler
import App from './App';

registerRootComponent(App);
