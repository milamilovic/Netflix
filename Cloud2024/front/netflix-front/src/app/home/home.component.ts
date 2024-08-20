import {Component, OnInit} from '@angular/core';
import {UserService} from "../user.service";
import {MovieService} from "../movie.service";
import { JwtHelperService } from '@auth0/angular-jwt';
import {Router} from "@angular/router";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  movies: any[] = [];
  username: string | null = '';
  isAdmin: boolean = false;

  constructor(private userService: UserService, private movieService: MovieService,
              private router: Router) { }

  ngOnInit(): void {
    const token = localStorage.getItem("idToken")
    if (token == null) {
      this.router.navigate(['/']);
      return;
    }
    const helper = new JwtHelperService();
    const decodedToken = helper.decodeToken(token);
    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"
    if(!this.isAdmin) {
      this.loadFeed();
    }
  }

  loadFeed(): void {
    this.username = localStorage.getItem('user');
    if (this.username){
      this.userService.loadFeed(this.username).subscribe({
        next: (response : any) => {
          console.log(response);
          const movieIds = response.Item.movieIds.SS;
          console.log(movieIds)
          this.loadMoviesMetadata(movieIds);
        },
        error: (err) => {
          console.error('Error loading feed:', err);
        }
      });
    }
  }

  loadMoviesMetadata(movieIds: string[]): void {
    for (let id of movieIds) {
      this.movieService.getMovie(id).subscribe({
        next: (movie) => {
          console.log(movie.id);
          const base64Thumbnail = "data:image/png;base64," + movie.thumbnailImage;
          movie.thumbnailImage = base64Thumbnail;
          this.movies.push(movie);
        },
        error: (error) => {
          console.error('Error loading movie metadata:', error);
        }
      });
    }
  }

  logout(){
    localStorage.removeItem('idToken');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
  }
}
