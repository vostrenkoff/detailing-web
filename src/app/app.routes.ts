import { Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { GalleryPageComponent } from './gallery-page.component';

export const routes: Routes = [
  {
    path: '',
    component: AppComponent
  },
  {
    path: 'gallery',
    component: GalleryPageComponent
  }
];
