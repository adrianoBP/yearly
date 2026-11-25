import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-policy',
  imports: [RouterLink],
  templateUrl: './policy.component.html',
  styleUrl: './policy.component.css',
})
export class PolicyComponent {
  emailAddress: string = 'adriano.boccardo@gmail.com';
}
