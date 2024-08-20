import { Component } from '@angular/core';
import { UserService } from '../user.service';
import { MovieService } from '../movie.service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent {
  title: string = '';
  genres: string = '';
  actors: string = '';
  directors: string = '';
  isAdmin: boolean = false;

  movies: any[] = [];
  username: string | null = '';

  constructor(private movieService: MovieService, private router: Router) {}

  // ngOnInit(): void {
  //   this.loadFeed();
  // }

  ngOnInit() {
    const token = localStorage.getItem('idToken');
    if (token == null) {
      this.router.navigate(['/']);
      return;
    }
    const helper = new JwtHelperService();
    const decodedToken = helper.decodeToken(token);
    const role = decodedToken['custom:role'];
    this.isAdmin = role == 'admin';
  }

  onSubmit() {
    const metadata = {
      title: this.title,
      actors: this.actors
        ? this.actors
            .split(',')
            .map((actor) => actor.trim())
            .filter((actor) => actor)
        : [],
      directors: this.directors
        ? this.directors
            .split(',')
            .map((director) => director.trim())
            .filter((director) => director)
        : [],
      genres: this.genres
        ? this.genres
            .split(',')
            .map((genre) => genre.trim())
            .filter((genre) => genre)
        : [],
    };

    console.log(metadata);
    this.movieService.searchMovies(metadata).subscribe(
      (data) => {
        let fetchedMovies = data;
        this.movies = [];
        fetchedMovies.forEach((movie: any) => {
          const base64Thumbnail =
            'data:image/png;base64,' + movie.thumbnailImage.S;
          movie.thumbnailImage = base64Thumbnail;
          movie.title = movie.title.S;
          movie.id = movie.id.S;
          movie.isMovie = Boolean(movie.isMovie);
          console.log(movie.isMovie);

          this.movies.push(movie);
        });
        console.log(this.movies);

        console.log('Search successful.');
      },
      (error) => {
        console.error('Error fetching movies.', error);
      }
    );
  }
}
