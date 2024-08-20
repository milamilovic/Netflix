import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ViewMovieComponent } from './view-movie/view-movie.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { ViewShowComponent } from './view-show/view-show.component';
import { UploadMovieComponent } from './upload-movie/upload-movie.component';
import { FormsModule } from '@angular/forms';
import { UploadShowComponent } from './upload-show/upload-show.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { UpdateMovieComponent } from './update-movie/update-movie.component';
import { UpdateShowComponent } from './update-show/update-show.component';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';
import { UpdateSubscriptionsComponent } from './update-subscriptions/update-subscriptions.component';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';
import { InterceptorInterceptor } from './interceptor.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    ViewMovieComponent,
    ViewShowComponent,
    UploadMovieComponent,
    UploadShowComponent,
    LoginComponent,
    RegisterComponent,
    UpdateMovieComponent,
    UpdateShowComponent,
    SubscriptionsComponent,
    UpdateSubscriptionsComponent,
    HomeComponent,
    SearchComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, HttpClientModule, FormsModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: InterceptorInterceptor,
      multi: true
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
