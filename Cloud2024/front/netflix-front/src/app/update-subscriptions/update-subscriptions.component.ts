import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../movie.service';
import { HttpClient } from '@angular/common/http';
import { JwtHelperService } from '@auth0/angular-jwt';
import {UserService} from "../user.service";

@Component({
  selector: 'app-update-subscriptions',
  templateUrl: './update-subscriptions.component.html',
  styleUrls: ['./update-subscriptions.component.css'],
})
export class UpdateSubscriptionsComponent {
  subscriptions: any;
  userId: string = '';
  userEmail: string = '';
  subscribedActors: string = '';
  subscribedGenres: string = '';
  subscribedDirectors: string = '';
  isAdmin: boolean = false;
  constructor(
    private route: ActivatedRoute,
    private movieService: MovieService,
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    const helper = new JwtHelperService();

    const token = localStorage.getItem('idToken');

    if (token == null) {
      this.router.navigate(['/']);
      return;
    }

    const decodedToken = helper.decodeToken(token);
    this.userId = decodedToken.sub;
    this.userEmail = decodedToken.email;

    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"

    this.movieService.getSubscriptions(this.userId).subscribe(
      (data) => {
        this.subscriptions = data.item;
        if (this.subscriptions) {
          this.subscribedActors =
            this.subscriptions.subscribedActors.join(', ');
          this.subscribedGenres =
            this.subscriptions.subscribedGenres.join(', ');
          this.subscribedDirectors =
            this.subscriptions.subscribedDirectors.join(', ');
        } else {
          this.subscriptions = {
            userId: this.userId,
            userEmail: this.userEmail,
            subscribedActors: [],
            subscribedGenres: [],
            subscribedDirectors: [],
          };
        }
        console.log('Subscriptions:', this.subscriptions);
      },
      (error) => {
        console.error('Error fetching subscriptions:', error);
      }
    );
  }

  onSubmit(): void {
    this.subscriptions.subscribedActors = this.subscribedActors
      .split(',')
      .map((actor) => actor.trim());
    this.subscriptions.subscribedDirectors = this.subscribedDirectors
      .split(',')
      .map((director) => director.trim());
    this.subscriptions.subscribedGenres = this.subscribedGenres
      .split(',')
      .map((genre) => genre.trim());
    console.log(this.subscriptions);
    this.movieService.subscribe(this.subscriptions).subscribe(
      (response) => {
        console.log('Subscriptions updated successfully', response);
        alert('Subscriptions updated successfully!');
        this.router.navigate(['/subscriptions']);
      },
      (error) => {
        console.error('Error updating Subscriptions', error);
        alert('Error updating Subscriptions!');
      }
    );
    const username = localStorage.getItem('user');
    if (username) {
      this.userService.generateFeed(username).subscribe({
        next: (response: any) => {
          console.log('generating feed...');
        },
        error: (err: any) => {
          console.error('Error generating feed: ', err)
        }
      });
    }
  }
}
