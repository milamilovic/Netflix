import { Component, OnInit } from '@angular/core';
import { UserService } from '../user.service';
import { Router} from "@angular/router";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {}

  onLogin() {
    if (this.username != '' && this.password != ''){
      this.userService.login(this.username, this.password).subscribe({
        next: (response: any) => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('user', this.username);
          localStorage.setItem('idToken', response.idToken);
          console.log('Login successful');
          this.router.navigate(['/home']);
        },
        error: (err) => {
          console.error('Login failed: ', err);
          alert(err.error.error);
        },
      });
    } else {
      alert("You must enter username and password")
    }
  }
}
