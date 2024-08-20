import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewMovieComponent } from './view-movie/view-movie.component';
import { AppComponent } from './app.component';
import { ViewShowComponent } from './view-show/view-show.component';
import { UploadMovieComponent } from './upload-movie/upload-movie.component';
import { UploadShowComponent } from './upload-show/upload-show.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { UpdateMovieComponent } from './update-movie/update-movie.component';
import { UpdateShowComponent } from './update-show/update-show.component';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';
import { UpdateSubscriptionsComponent } from './update-subscriptions/update-subscriptions.component';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';

const routes: Routes = [
  { path: '', component: HomeComponent }, // Default route
  { path: 'movie/:id', component: ViewMovieComponent },
  { path: 'show/:title', component: ViewShowComponent },
  { path: 'upload-movie', component: UploadMovieComponent },
  { path: 'upload-show', component: UploadShowComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'update-movie/:id', component: UpdateMovieComponent },
  { path: 'update-show/:id', component: UpdateShowComponent },
  { path: 'subscriptions', component: SubscriptionsComponent },
  { path: 'subscriptions/update', component: UpdateSubscriptionsComponent },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
