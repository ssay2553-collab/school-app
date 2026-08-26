import { Href, Link, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Platform } from 'react-native';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string; title?: string };

export function ExternalLink({ href, title, ...rest }: Props) {
  const router = useRouter();

  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={(event) => {
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in the shared WebView screen.
          router.push({
            pathname: '/shared/web-view',
            params: { url: href, title: title || 'External Link' },
          });
        }
      }}
    />
  );
}
